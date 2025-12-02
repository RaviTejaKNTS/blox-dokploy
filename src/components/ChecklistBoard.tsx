"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
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
  className?: string;
};

export function ChecklistBoard({ slug, items, className }: ChecklistBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number>(0);

  const sections = useMemo(() => groupSections(items), [items]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflowY;
    const prevHtmlOverflow = document.documentElement.style.overflowY;
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = prevBodyOverflow;
      document.documentElement.style.overflowY = prevHtmlOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
      const height = Math.max(320, viewportHeight - rect.top - 24);
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

  const columns = useMemo(() => {
    const maxHeight = availableHeight > 0 ? availableHeight - 16 : containerHeight > 0 ? containerHeight - 16 : 640;
    return buildColumns(sections, maxHeight);
  }, [sections, availableHeight, containerHeight]);

  const setSectionRef = (code: string) => (node: HTMLDivElement | null) => {
    sectionRefs.current.set(code, node);
  };

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
        "relative w-full max-w-full min-w-0 overflow-hidden",
        className
      )}
      style={{ height: availableHeight || undefined }}
    >
      <div
        ref={containerRef}
        className="flex h-full w-full min-w-0 gap-6 overflow-x-auto overflow-y-hidden px-4 py-3 [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
            return groups.map((group) => (
              <div key={`group-${group.topCode}`} className="flex flex-col gap-3">
                <div className="space-y-1 px-1">
                  <div className="text-lg font-extrabold leading-snug text-foreground">
                    {group.topCode}. {group.topLabel}
                  </div>
                  <div className="h-px w-full bg-border/80" />
                </div>
                {(() => {
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
                    <div className="flex gap-6">
                      {sectionGroups.map((sg, sgIdx) => {
                        const colCount = sg.cols.length || 1;
                        const colWidth = 320; // px (20rem) matches w-80
                        const gapWidth = 24; // px (gap-6)
                        const spanWidth = colCount * colWidth + Math.max(0, colCount - 1) * gapWidth;
                        return (
                          <div
                            key={`${group.topCode}-${sg.code}-${sgIdx}`}
                            className="flex flex-col gap-3 shrink-0"
                            style={{ minWidth: `${spanWidth}px` }}
                          >
                            <div className="space-y-1 px-1">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                                {sg.code}
                              </div>
                              <div className="text-sm font-semibold text-foreground">{sg.name}</div>
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
                                                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition",
                                                  "border-border/50 bg-surface/80 shadow-[0_1px_6px_rgba(0,0,0,0.06)] hover:border-accent/70 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
                                                  isChecked ? "opacity-70 bg-surface/60" : "opacity-100"
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
                                                    "mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-bold transition",
                                                    isChecked
                                                      ? "border-accent bg-accent text-background shadow-[0_6px_18px_rgba(0,0,0,0.15)]"
                                                      : "border-border/70 bg-background/90 text-transparent"
                                                  )}
                                                  aria-hidden
                                                >
                                                  ✓
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
                  );
                })()}
              </div>
            ));
          })()
        )}
      </div>
    </div>
  );
}
