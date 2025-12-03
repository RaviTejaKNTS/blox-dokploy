"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FiCheckCircle } from "react-icons/fi";
import type { ChecklistItem } from "@/lib/db";

type SectionBlock = {
  code: string;
  name: string;
  items: ChecklistItem[];
  topCode: string;
  chunkKey: string;
  continuation?: boolean;
};

type ColumnBlock = {
  topCode: string;
  topLabel: string;
  sections: SectionBlock[];
  continuation: boolean;
};

const DEFAULT_ITEM_HEIGHT = 68; // fallback if we haven't measured yet
const DEFAULT_HEADER_HEIGHT = 48;
const ITEM_HEIGHT = DEFAULT_ITEM_HEIGHT;
const SECTION_HEADER = DEFAULT_HEADER_HEIGHT;
const SECTION_PADDING = 18;
const ITEM_GAP = 12;
const SECTION_GAP = 16;
const COLUMN_VERTICAL_PADDING = 20;
const MIN_REMAINING_BEFORE_WRAP = 240;
const CONT_HEADER_EXTRA = 10;

function parseCodeParts(code: string): { top: number; child: number | null } {
  const parts = code.split(".").map((p) => Number.parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  return {
    top: parts[0] ?? 0,
    child: parts.length > 1 ? parts[1] : null
  };
}

function compareCodes(a: string, b: string): number {
  const pa = parseCodeParts(a);
  const pb = parseCodeParts(b);
  if (pa.top !== pb.top) return pa.top - pb.top;
  return (pa.child ?? -1) - (pb.child ?? -1);
}

function groupSections(items: ChecklistItem[]): SectionBlock[] {
  const map = new Map<string, SectionBlock>();
  for (const item of items) {
    const code = item.section_code.trim();
    const existing = map.get(code);
    if (existing) {
      existing.items.push(item);
    } else {
      const { top } = parseCodeParts(code);
      map.set(code, {
        code,
        name: item.section_name,
        items: [item],
        topCode: String(top),
        chunkKey: `${code}-0`
      });
    }
  }

  return Array.from(map.values())
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
    }))
    .sort((a, b) => compareCodes(a.code, b.code));
}

function estimateChunkHeight(itemCount: number, includeHeader: boolean): number {
  const headerHeight = includeHeader ? SECTION_HEADER + SECTION_PADDING * 2 : CONT_HEADER_EXTRA + SECTION_PADDING;
  const itemsHeight = itemCount * ITEM_HEIGHT + Math.max(0, itemCount - 1) * ITEM_GAP;
  return headerHeight + itemsHeight + SECTION_GAP;
}

function fitItemsIntoSpace(remaining: number, includeHeader: boolean): number {
  const headerHeight = includeHeader ? SECTION_HEADER + SECTION_PADDING * 2 : CONT_HEADER_EXTRA + SECTION_PADDING;
  const availableForItems = remaining - headerHeight - SECTION_GAP;
  if (availableForItems <= ITEM_HEIGHT) {
    return availableForItems >= ITEM_HEIGHT ? 1 : 0;
  }
  const perItem = ITEM_HEIGHT + ITEM_GAP;
  return Math.max(1, Math.floor((availableForItems + ITEM_GAP) / perItem));
}

function chunkSectionsByHeight(
  sections: SectionBlock[],
  maxHeight: number
): SectionBlock[][] {
  if (!sections.length) return [];
  const columns: SectionBlock[][] = [];
  let current: SectionBlock[] = [];
  let usedHeight = COLUMN_VERTICAL_PADDING;
  let chunkCounter = 0;

  for (const section of sections) {
    let remainingItems = [...section.items];
    let isFirstChunk = true;

    while (remainingItems.length) {
      let remainingSpace = maxHeight - usedHeight;
      if (current.length > 0 && remainingSpace < MIN_REMAINING_BEFORE_WRAP) {
        columns.push(current);
        current = [];
        usedHeight = COLUMN_VERTICAL_PADDING;
        remainingSpace = maxHeight - usedHeight;
      }

      const includeHeader = isFirstChunk;
      const headerHeight = includeHeader ? SECTION_HEADER + SECTION_PADDING * 2 : CONT_HEADER_EXTRA + SECTION_PADDING;
      const availableForItems = remainingSpace - headerHeight - SECTION_GAP;

      const perItem = DEFAULT_ITEM_HEIGHT + ITEM_GAP;
      let capacity = Math.max(1, Math.floor((availableForItems + ITEM_GAP) / perItem));
      capacity = Math.min(capacity, remainingItems.length);

      if (capacity === 0) {
        if (current.length) {
          columns.push(current);
          current = [];
          usedHeight = COLUMN_VERTICAL_PADDING;
          capacity = Math.min(1, remainingItems.length);
        } else {
          capacity = Math.min(1, remainingItems.length);
        }
      }

      const chunkItems = remainingItems.splice(0, capacity);
      const chunk: SectionBlock = {
        code: section.code,
        name: section.name,
        items: chunkItems,
        topCode: section.topCode,
        chunkKey: `${section.code}-${chunkCounter++}`,
        continuation: !isFirstChunk
      };

      const itemsHeight = chunkItems.length * DEFAULT_ITEM_HEIGHT + Math.max(0, chunkItems.length - 1) * ITEM_GAP;
      const chunkHeight = headerHeight + itemsHeight + SECTION_GAP;
      current.push(chunk);
      usedHeight += chunkHeight;
      isFirstChunk = false;
    }

    // Force next section to start in a fresh column
    if (current.length) {
      columns.push(current);
      current = [];
      usedHeight = COLUMN_VERTICAL_PADDING;
    }
  }

  if (current.length) {
    columns.push(current);
  }

  return columns;
}

function buildColumns(
  sections: SectionBlock[],
  maxHeight: number
): ColumnBlock[] {
  const groupedByTop = new Map<string, SectionBlock[]>();
  for (const section of sections) {
    const group = groupedByTop.get(section.topCode) ?? [];
    group.push(section);
    groupedByTop.set(section.topCode, group);
  }

  const result: ColumnBlock[] = [];
  const sortedTopCodes = Array.from(groupedByTop.keys()).sort((a, b) => Number(a) - Number(b));

  for (const topCode of sortedTopCodes) {
    const groupSections = groupedByTop.get(topCode) ?? [];
    const topLabelSource = groupSections.find((s) => s.code === topCode) ?? groupSections[0];
    const topLabel = topLabelSource?.name ?? `Section ${topCode}`;

    const buckets = chunkSectionsByHeight(groupSections, maxHeight);
    buckets.forEach((bucket, index) => {
      result.push({
        topCode,
        topLabel,
        sections: bucket,
        continuation: index > 0
      });
    });
  }

  return result;
}

type ChecklistBoardProps = {
  slug: string;
  items: ChecklistItem[];
  descriptionHtml?: string | null;
  className?: string;
};

export function ChecklistBoard({ slug, items, descriptionHtml, className }: ChecklistBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number>(0);

  const sections = useMemo(() => groupSections(items), [items]);
  const categoryDescriptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const { top, child } = parseCodeParts(item.section_code);
      if (child === null && item.description && !map.has(String(top))) {
        map.set(String(top), item.description);
      }
    }
    return map;
  }, [items]);
  const progressByTopCode = useMemo(() => {
    const totals = new Map<string, number>();
    const done = new Map<string, number>();

    for (const item of items) {
      const { top } = parseCodeParts(item.section_code);
      const key = String(top);
      totals.set(key, (totals.get(key) ?? 0) + 1);
      if (checked.has(item.id)) {
        done.set(key, (done.get(key) ?? 0) + 1);
      }
    }

    const result: Record<string, { total: number; done: number; percent: number }> = {};
    for (const [key, total] of totals.entries()) {
      const completed = done.get(key) ?? 0;
      result[key] = {
        total,
        done: completed,
        percent: total ? Math.round((completed / total) * 100) : 0
      };
    }
    return result;
  }, [items, checked]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = prevBodyOverflowY;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      const bottomGutter =
        typeof window !== "undefined" ? Math.max(96, Math.min(180, Math.floor(viewportHeight * 0.15))) : 96;
      const height = Math.max(320, viewportHeight - rect.top - bottomGutter);
      setAvailableHeight(height);
      setContainerHeight(height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const key = `checklist:${slug}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setChecked(new Set(parsed.filter((id): id is string => typeof id === "string")));
        }
      }
    } catch {
      // ignore
    }
  }, [slug]);

  const storageKey = `checklist:${slug}`;
  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const detail = { slug, checkedCount: checked.size, totalCount: items.length };
    window.dispatchEvent(new CustomEvent("checklist-progress", { detail }));
  }, [slug, checked, items.length]);

  const columns = useMemo(() => {
    const baseHeight =
      availableHeight > 0 ? availableHeight : containerHeight > 0 ? containerHeight : 640;
    const maxHeight = Math.max(240, baseHeight - 56); // reserve bottom breathing room
    return buildColumns(sections, maxHeight);
  }, [sections, availableHeight, containerHeight]);

  const setSectionRef = (code: string) => (node: HTMLDivElement | null) => {
    sectionRefs.current.set(code, node);
  };

  const scrollTargetRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node =
      containerRef.current ??
      (typeof document !== "undefined"
        ? (document.querySelector("[data-checklist-scroll]") as HTMLElement | null)
        : null);
    scrollTargetRef.current = node;
  }, [containerRef.current]);

  const getScrollTarget = useCallback((): HTMLElement | null => {
    if (scrollTargetRef.current) return scrollTargetRef.current;
    if (containerRef.current) {
      scrollTargetRef.current = containerRef.current;
      return containerRef.current;
    }
    if (typeof document !== "undefined") {
      const el = document.querySelector("[data-checklist-scroll]") as HTMLElement | null;
      scrollTargetRef.current = el;
      return el;
    }
    return null;
  }, []);

  const applyHorizontalScroll = useCallback(
    (deltaX: number, deltaY: number, deltaMode: number) => {
      const target = getScrollTarget();
      if (!target) return;
      const overflowX = target.scrollWidth - target.clientWidth;
      if (overflowX <= 0) return;

      const scale = deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1; // line or page modes
      const dx = deltaX * scale;
      const dy = deltaY * scale;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (!delta) return;
      // debug logging
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[checklist] wheel", { dx, dy, deltaMode, chosen: delta, targetOverflow: overflowX });
      }
      const next = Math.min(Math.max(0, target.scrollLeft + delta), overflowX);
      if (next !== target.scrollLeft) {
        target.scrollLeft = next;
      }
    },
    [getScrollTarget]
  );

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      applyHorizontalScroll(event.deltaX, event.deltaY, event.deltaMode);
      const target = getScrollTarget();
      if (target && target.scrollWidth > target.clientWidth) {
        event.preventDefault();
        event.stopPropagation();
      } else if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[checklist] wheel ignored", {
          hasTarget: Boolean(target),
          scrollWidth: target?.scrollWidth,
          clientWidth: target?.clientWidth
        });
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true } as AddEventListenerOptions);
    };
  }, [applyHorizontalScroll, getScrollTarget]);

  useEffect(() => {
    const target = getScrollTarget();
    if (!target) return;

    let isTouching = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (target.scrollWidth <= target.clientWidth) return;
      const touch = event.touches[0];
      if (!touch) return;
      isTouching = true;
      startX = touch.clientX;
      startY = touch.clientY;
      startScrollLeft = target.scrollLeft;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTouching) return;
      if (target.scrollWidth <= target.clientWidth) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const dominant = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      target.scrollLeft = startScrollLeft - dominant;
      event.preventDefault();
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[checklist] touch move", {
          deltaX,
          deltaY,
          dominant,
          scrollLeft: target.scrollLeft
        });
      }
    };

    const handleTouchEnd = () => {
      isTouching = false;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  if (!mounted) {
    return (
      <div
        className={clsx(
          "relative w-full max-w-none h-[calc(100vh-180px)] min-h-[60vh] overflow-hidden",
          className
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        "relative w-full max-w-full min-w-0 overflow-hidden pb-6",
        className
      )}
      style={{ height: availableHeight || undefined }}
    >
      <div
        ref={containerRef}
        className="flex h-full w-full min-w-0 gap-6 overflow-x-auto overflow-y-hidden px-4 py-3 pb-16 touch-pan-x [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {descriptionHtml ? (
          <div className="flex h-full w-[420px] shrink-0 flex-col rounded-2xl border border-border/60 bg-surface/70 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div
              className="prose dark:prose-invert max-w-none game-copy text-foreground"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </div>
        ) : null}
        {columns.length === 0 ? (
          <div className="flex w-full items-center justify-center">
            <p className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
              No checklist items yet.
            </p>
          </div>
        ) : (
          (() => {
            const groups: { topCode: string; topLabel: string; cols: typeof columns }[] = [];
            for (const col of columns) {
              const last = groups[groups.length - 1];
              if (!last || last.topCode !== col.topCode) {
                groups.push({ topCode: col.topCode, topLabel: col.topLabel, cols: [col] });
              } else {
                last.cols.push(col);
              }
            }
            return groups.map((group) => {
              const progress = progressByTopCode[group.topCode] ?? { total: 0, done: 0, percent: 0 };
              const categoryDescription = categoryDescriptions.get(group.topCode);

              const sectionGroups: { code: string; name: string; cols: typeof group.cols }[] = [];
              for (const col of group.cols) {
                const section = col.sections[0];
                const last = sectionGroups[sectionGroups.length - 1];
                if (!last || last.code !== section.code) {
                  sectionGroups.push({ code: section.code, name: section.name, cols: [col] });
                } else {
                  last.cols.push(col);
                }
              }

              return (
                <div key={`group-${group.topCode}`} className="flex flex-col gap-3">
                  <div className="space-y-1.5 px-1">
                    <h2 className="text-lg font-extrabold leading-snug text-foreground">
                      {group.topCode}. {group.topLabel}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div
                        className="h-2.5 flex-1 overflow-hidden rounded-full bg-border/70"
                        role="progressbar"
                        aria-label={`Progress for ${group.topLabel}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress.percent}
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                        <span className="text-foreground">{progress.done}/{progress.total}</span>
                        <span>tasks done</span>
                        <span className="text-border">.</span>
                        <span className="text-foreground">{progress.percent}%</span>
                        <span>complete</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-7">
                    {categoryDescription ? (
                      <div className="relative w-[440px] shrink-0 self-start rounded-2xl border border-border/60 bg-surface/70 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                        <div className="prose dark:prose-invert max-w-none game-copy text-foreground">
                          <p className="whitespace-pre-line">{categoryDescription}</p>
                        </div>
                        <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-surface/90 to-transparent" />
                      </div>
                    ) : null}
                    <div className="flex gap-7">
                      {sectionGroups.map((sg, sgIdx) => {
                        const colCount = sg.cols.length || 1;
                        const colWidth = 320; // px (20rem) matches w-80
                        const gapWidth = 28; // px (gap-7)
                        const spanWidth = colCount * colWidth + Math.max(0, colCount - 1) * gapWidth;
                        return (
                          <div
                            key={`${group.topCode}-${sg.code}-${sgIdx}`}
                            className="flex flex-col gap-3 shrink-0"
                            style={{ minWidth: `${spanWidth}px` }}
                          >
                            <div className="space-y-1 px-1">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                                  {sg.code}
                                </span>
                                <span className="text-sm font-semibold text-foreground">{sg.name}</span>
                              </div>
                              <div className="h-px w-full bg-border/60" />
                            </div>
                            <div className="flex gap-6">
                              {sg.cols.map((column, idx) => (
                                <div
                                  key={`${column.topCode}-${sg.code}-${idx}`}
                                  className="flex w-80 shrink-0 flex-col gap-5"
                                >
                                  <div className="flex flex-1 flex-col gap-5 overflow-hidden">
                                    {column.sections.map((section) => (
                                      <div
                                        key={section.chunkKey}
                                        ref={setSectionRef(section.chunkKey)}
                                        className="space-y-3"
                                      >
                                        <div className="flex flex-col gap-2">
                                          {section.items.map((item) => {
                                            const isChecked = checked.has(item.id);
                                            return (
                                              <label
                                                key={item.id}
                                                className={clsx(
                                                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm transition",
                                                  "border-border/60 bg-surface/85 shadow-[0_1px_6px_rgba(0,0,0,0.06)] hover:border-accent/70 hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]",
                                                  isChecked ? "bg-surface/70" : "bg-surface/90"
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => toggleItem(item.id)}
                                                  className="sr-only"
                                                />
                                                <span
                                                  className={clsx(
                                                    "relative mt-0.5 flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px] border transition duration-250",
                                                    isChecked
                                                      ? "border-accent shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
                                                      : "border-border/80 hover:border-foreground/70 hover:ring-2 hover:ring-accent/30"
                                                  )}
                                                  aria-hidden
                                                >
                                                  <span className="absolute inset-0 rounded-[5px] bg-black/85" />
                                                  <span
                                                    className={clsx(
                                                      "absolute inset-0 origin-left rounded-[5px] bg-accent transition-transform duration-200 ease-out",
                                                      isChecked ? "scale-x-100" : "scale-x-0"
                                                    )}
                                                  />
                                                  {isChecked ? (
                                                    <FiCheckCircle className="relative z-10 h-3.5 w-3.5 text-background transition-colors duration-150" />
                                                  ) : null}
                                                </span>
                                                <div className="flex-1 space-y-1 leading-snug">
                                                  <div
                                                    className={clsx(
                                                      "font-semibold text-foreground",
                                                      isChecked ? "line-through decoration-2" : undefined
                                                    )}
                                                  >
                                                    {item.title}
                                                  </div>
                                                  {item.description ? (
                                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                                  ) : null}
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}
