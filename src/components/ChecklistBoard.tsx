"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FiCheckCircle, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import type { ChecklistItem } from "@/lib/db";
import { ContentSlot } from "@/components/ContentSlot";
import { trackEvent } from "@/lib/analytics";
import {
  loadAccountChecklistProgress,
  readLocalChecklistProgress,
  saveAccountChecklistProgress,
  updateChecklistProgressCount,
  useChecklistSession,
  writeLocalChecklistProgress
} from "@/lib/checklist-progress-client";

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
const DEFAULT_BOARD_HEIGHT = 640;
const COLUMN_HEIGHT_BUFFER = 32;
const PROGRESS_MILESTONES = [25, 50, 75, 100];

function parseCodeParts(code: string): { top: number; child: number | null; leaf: number | null } {
  const parts = code.split(".").map((p) => Number.parseInt(p, 10)).filter((n) => !Number.isNaN(n));
  return {
    top: parts[0] ?? 0,
    child: parts.length > 1 ? parts[1] : null,
    leaf: parts.length > 2 ? parts[2] : null
  };
}

function formatSectionLabel(code: string): string {
  const parts = parseCodeParts(code);
  if (parts.child !== null && parts.child !== 0) {
    return `Section ${parts.top}.${parts.child}`;
  }
  return `Section ${parts.top}`;
}

function compareCodes(a: string, b: string): number {
  const pa = parseCodeParts(a);
  const pb = parseCodeParts(b);
  if (pa.top !== pb.top) return pa.top - pb.top;
  return (pa.child ?? -1) - (pb.child ?? -1);
}

function groupSections(items: ChecklistItem[]): SectionBlock[] {
  const parentTitles = new Map<string, string>();
  const subTitles = new Map<string, string>();

  // Collect titles from structural rows (parents and subs)
  for (const item of items) {
    const { top, child, leaf } = parseCodeParts(item.section_code.trim());
    if (leaf !== null) continue;
    if (child === null) {
      parentTitles.set(String(top), item.title.trim());
    } else {
      subTitles.set(`${top}.${child}`, item.title.trim());
    }
  }

  const map = new Map<string, SectionBlock>();

  for (const item of items) {
    const rawCode = item.section_code.trim();
    const parts = parseCodeParts(rawCode);
    // Skip structural rows for items (parents/subs are only labels)
    if (parts.leaf === null) continue;

    // Determine the sub bucket; if no real subcategory (child === 0), bucket under the parent
    const code =
      parts.child !== null && parts.child !== 0 ? `${parts.top}.${parts.child}` : `${parts.top}.0`;
    const existing = map.get(code);
    if (existing) {
      existing.items.push(item);
    } else {
      const top = parts.top;
      const explicitTitle = subTitles.get(code) ?? null;
      const label =
        explicitTitle ??
        (parts.child !== null && parts.child !== 0
          ? `Section ${parts.top}.${parts.child}`
          : "Checklist");
      map.set(code, {
        code,
        name: label,
        items: [item],
        topCode: String(top),
        chunkKey: `${code}-0`
      });
    }
  }

  return Array.from(map.values())
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => {
        const pa = parseCodeParts(a.section_code);
        const pb = parseCodeParts(b.section_code);
        const leafA = pa.leaf ?? 0;
        const leafB = pb.leaf ?? 0;
        if (leafA !== leafB) return leafA - leafB;
        return a.title.localeCompare(b.title);
      })
    }))
    .sort((a, b) => compareCodes(a.code, b.code));
}

function parseTitleLink(raw: string): { label: string; href: string | null } {
  const trimmed = raw.trim();
  const mdMatch = trimmed.match(/^\[(.+?)\]\((https?:\/\/\S+)\)$/);
  if (mdMatch) {
    return { label: mdMatch[1], href: mdMatch[2] };
  }
  const urlMatch = trimmed.match(/(https?:\/\/\S+)/);
  if (urlMatch) {
    const href = urlMatch[1];
    const label = trimmed.replace(urlMatch[0], "").trim() || href;
    return { label, href };
  }
  return { label: trimmed, href: null };
}

function shouldInsertGroupAd(index: number, total: number): boolean {
  return index % 3 === 0 && index < total - 1;
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
    // Force each section to start in a new column
    if (current.length > 0) {
      columns.push(current);
      current = [];
      usedHeight = COLUMN_VERTICAL_PADDING;
    }

    // Calculate total height needed for this entire section
    const headerHeight = SECTION_HEADER + SECTION_PADDING * 2;
    const itemsHeight = section.items.length * DEFAULT_ITEM_HEIGHT + Math.max(0, section.items.length - 1) * ITEM_GAP;
    const totalSectionHeight = headerHeight + itemsHeight + SECTION_GAP;

    // Check if the entire section fits in one column
    if (totalSectionHeight <= maxHeight - COLUMN_VERTICAL_PADDING) {
      // Entire section fits in one column
      const chunk: SectionBlock = {
        code: section.code,
        name: section.name,
        items: section.items,
        topCode: section.topCode,
        chunkKey: `${section.code}-${chunkCounter++}`,
        continuation: false
      };
      current.push(chunk);
      usedHeight += totalSectionHeight;
    } else {
      // Section is too large for one column, must split it
      let remainingItems = [...section.items];
      let isFirstChunk = true;

      while (remainingItems.length > 0) {
        // Start new column if needed
        let availableSpace = maxHeight - usedHeight;
        if (current.length > 0 && availableSpace < MIN_REMAINING_BEFORE_WRAP) {
          columns.push(current);
          current = [];
          usedHeight = COLUMN_VERTICAL_PADDING;
          availableSpace = maxHeight - usedHeight;
        }

        const chunkHeaderHeight = isFirstChunk ? SECTION_HEADER + SECTION_PADDING * 2 : CONT_HEADER_EXTRA + SECTION_PADDING;
        const availableForItems = availableSpace - chunkHeaderHeight - SECTION_GAP;

        const perItem = DEFAULT_ITEM_HEIGHT + ITEM_GAP;
        let capacity = Math.max(1, Math.floor((availableForItems + ITEM_GAP) / perItem));
        capacity = Math.min(capacity, remainingItems.length);

        if (capacity === 0) {
          // Force new column
          if (current.length > 0) {
            columns.push(current);
            current = [];
            usedHeight = COLUMN_VERTICAL_PADDING;
          }
          capacity = Math.min(1, remainingItems.length);
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

        const chunkItemsHeight = chunkItems.length * DEFAULT_ITEM_HEIGHT + Math.max(0, chunkItems.length - 1) * ITEM_GAP;
        const chunkHeight = chunkHeaderHeight + chunkItemsHeight + SECTION_GAP;
        current.push(chunk);
        usedHeight += chunkHeight;
        isFirstChunk = false;
      }
    }
  }

  if (current.length) {
    columns.push(current);
  }

  return columns;
}

function buildColumns(
  sections: SectionBlock[],
  maxHeight: number,
  parentTitles: Map<string, string>
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
    const topLabel =
      parentTitles.get(topCode) ??
      groupSections.find((s) => s.code === topCode)?.name ??
      groupSections[0]?.name ??
      `Section ${topCode}`;

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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const session = useChecklistSession();
  const checkedRef = useRef(checked);
  const pendingPersistRef = useRef(false);
  const changeVersionRef = useRef(0);
  const availableHeight = DEFAULT_BOARD_HEIGHT;
  const [isNarrow, setIsNarrow] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const computedClassName = isNarrow ? undefined : className;

  const sections = useMemo(() => groupSections(items), [items]);
  const totalLeafItems = useMemo(
    () => items.filter((item) => parseCodeParts(item.section_code.trim()).leaf !== null).length,
    [items]
  );
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
      const parts = parseCodeParts(item.section_code);
      // Count only leaf items toward progress
      if (parts.leaf === null) continue;
      const top = parts.top;
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
    const measureWidth = () => {
      if (typeof window === "undefined") return;
      setIsNarrow(window.innerWidth <= 900 || window.innerHeight > window.innerWidth);
      setIsLargeScreen(window.innerWidth >= 1600);
    };
    measureWidth();
    window.addEventListener("resize", measureWidth);
    return () => window.removeEventListener("resize", measureWidth);
  }, []);

  useEffect(() => {
    if (isNarrow) return;
    if (typeof window !== "undefined" && availableHeight > window.innerHeight - 24) return;
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;

    // Lock scroll
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflowY = "hidden";

    // Hide footer via style injection
    const style = document.createElement("style");
    style.innerHTML = "footer { display: none !important; }";
    document.head.appendChild(style);

    return () => {
      document.body.style.overflowY = prevBodyOverflowY;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
      document.head.removeChild(style);
    };
  }, [isNarrow, availableHeight]);

  // Height is fixed to avoid column reflow after hydration.

  useEffect(() => {
    checkedRef.current = checked;
  }, [checked]);

  useEffect(() => {
    pendingPersistRef.current = false;
    changeVersionRef.current = 0;
  }, [slug]);

  useEffect(() => {
    if (session.status !== "ready") return;

    if (pendingPersistRef.current) {
      const ids = Array.from(checkedRef.current);
      if (session.userId) {
        void saveAccountChecklistProgress(slug, ids);
        updateChecklistProgressCount(session.userId, slug, ids.length);
      } else {
        const merged = new Set(readLocalChecklistProgress(slug));
        ids.forEach((id) => merged.add(id));
        const mergedIds = Array.from(merged);
        setChecked(new Set(mergedIds));
        writeLocalChecklistProgress(slug, mergedIds);
      }
      pendingPersistRef.current = false;
      return;
    }

    if (!session.userId) {
      setChecked(new Set(readLocalChecklistProgress(slug)));
      return;
    }

    let isActive = true;
    void (async () => {
      const loadVersion = changeVersionRef.current;
      const ids = await loadAccountChecklistProgress(slug);
      if (!isActive) return;
      if (changeVersionRef.current !== loadVersion) return;
      setChecked(new Set(ids));
      updateChecklistProgressCount(session.userId, slug, ids.length);
    })();

    return () => {
      isActive = false;
    };
  }, [session.status, session.userId, slug]);
  const lastMilestoneRef = useRef(0);
  const milestonesInitialized = useRef(false);

  const toggleItem = (item: ChecklistItem) => {
    const sessionReady = session.status === "ready";
    changeVersionRef.current += 1;
    setChecked((prev) => {
      const next = new Set(prev);
      const nextChecked = !next.has(item.id);
      if (nextChecked) {
        next.add(item.id);
      } else {
        next.delete(item.id);
      }
      const nextIds = Array.from(next);

      if (sessionReady) {
        if (session.userId) {
          void saveAccountChecklistProgress(slug, nextIds);
          updateChecklistProgressCount(session.userId, slug, nextIds.length);
        } else {
          writeLocalChecklistProgress(slug, nextIds);
        }
      } else {
        pendingPersistRef.current = true;
      }
      trackEvent("checklist_item_toggle", {
        checklist_slug: slug,
        item_id: item.id,
        section_code: item.section_code,
        checked: nextChecked
      });
      return next;
    });
  };

  useEffect(() => {
    lastMilestoneRef.current = 0;
    milestonesInitialized.current = false;
  }, [slug, totalLeafItems]);

  useEffect(() => {
    if (!totalLeafItems) return;
    const percent = Math.round((checked.size / totalLeafItems) * 100);
    const reached = PROGRESS_MILESTONES.filter((value) => percent >= value).pop() ?? 0;
    if (!milestonesInitialized.current) {
      lastMilestoneRef.current = reached;
      milestonesInitialized.current = true;
      return;
    }
    for (const milestone of PROGRESS_MILESTONES) {
      if (milestone > lastMilestoneRef.current && percent >= milestone) {
        trackEvent("checklist_progress", {
          checklist_slug: slug,
          percent: milestone,
          done: checked.size,
          total: totalLeafItems
        });
        lastMilestoneRef.current = milestone;
      }
    }
  }, [checked.size, slug, totalLeafItems]);

  useEffect(() => {
    const detail = { slug, checkedCount: checked.size, totalCount: items.length };
    window.dispatchEvent(new CustomEvent("checklist-progress", { detail }));
  }, [slug, checked, items.length]);

  const parentTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const { top, child, leaf } = parseCodeParts(item.section_code);
      if (leaf === null && child === null) {
        map.set(String(top), item.title.trim());
      }
    }
    return map;
  }, [items]);

  const groupedSections = useMemo(() => {
    const grouped = new Map<string, { topLabel: string; sections: SectionBlock[] }>();
    for (const section of sections) {
      const topKey = section.topCode;
      const entry = grouped.get(topKey) ?? { topLabel: parentTitles.get(topKey) ?? section.name, sections: [] };
      entry.sections.push(section);
      grouped.set(topKey, entry);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([topCode, value]) => ({
        topCode,
        topLabel: value.topLabel || `Section ${topCode}`,
        sections: value.sections
      }));
  }, [sections, parentTitles]);

  const columns = useMemo(() => {
    if (isNarrow) return [];
    const maxHeight = Math.max(240, DEFAULT_BOARD_HEIGHT - COLUMN_HEIGHT_BUFFER); // reserve bottom breathing room
    return buildColumns(sections, maxHeight, parentTitles);
  }, [sections, isNarrow, parentTitles]);

  const setSectionRef = (code: string) => (node: HTMLDivElement | null) => {
    sectionRefs.current.set(code, node);
  };

  const scrollTargetRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node =
      (typeof document !== "undefined"
        ? (document.querySelector("[data-checklist-scroll]") as HTMLElement | null)
        : null) ?? containerRef.current;
    scrollTargetRef.current = node;
  }, [containerRef.current]);

  const getScrollTarget = useCallback((): HTMLElement | null => {
    if (scrollTargetRef.current) return scrollTargetRef.current;

    // Prioritize external scroll target (page wrapper)
    if (typeof document !== "undefined") {
      const el = document.querySelector("[data-checklist-scroll]") as HTMLElement | null;
      if (el) {
        scrollTargetRef.current = el;
        return el;
      }
    }

    if (containerRef.current) {
      scrollTargetRef.current = containerRef.current;
      return containerRef.current;
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
    if (isNarrow) return;
    const handleWheel = (event: WheelEvent) => {
      // Always capture wheel events on the window to force horizontal scroll
      applyHorizontalScroll(event.deltaX, event.deltaY, event.deltaMode);

      // Prevent default vertical scrolling if we have a target
      const target = getScrollTarget();
      if (target) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Attach to window to capture ALL scroll events
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true } as AddEventListenerOptions);
    };
  }, [applyHorizontalScroll, getScrollTarget, isNarrow]);

  const updateArrows = useCallback(() => {
    const target = getScrollTarget();
    if (!target) return;
    setShowLeftArrow(target.scrollLeft > 10);
    setShowRightArrow(target.scrollLeft < target.scrollWidth - target.clientWidth - 10);
  }, [getScrollTarget]);

  useEffect(() => {
    const target = getScrollTarget();
    if (!target) return;
    target.addEventListener("scroll", updateArrows);
    window.addEventListener("resize", updateArrows);
    // Initial check
    setTimeout(updateArrows, 100);
    return () => {
      target.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [getScrollTarget, updateArrows, columns]);

  const scrollByArrow = (direction: "left" | "right") => {
    const target = getScrollTarget();
    if (!target) return;
    const amount = direction === "left" ? -400 : 400;
    target.scrollBy({ left: amount, behavior: "smooth" });
  };

  useEffect(() => {
    if (isNarrow) return;
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

  if (isNarrow) {
    return (
      <div className={clsx("flex w-full flex-col gap-8 pb-12 overflow-x-hidden", computedClassName)}>
        {descriptionHtml ? (
          <div className="flex w-full flex-col rounded-2xl border border-border/60 bg-surface/70 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <div
              className="prose dark:prose-invert max-w-none game-copy text-foreground"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </div>
        ) : null}
        {groupedSections.flatMap((group, index) => {
          const progress = progressByTopCode[group.topCode] ?? { total: 0, done: 0, percent: 0 };
          const categoryDescription = categoryDescriptions.get(group.topCode);
          const sectionNode = (
            <section
              key={`mobile-${group.topCode}`}
              className="flex flex-col gap-5"
            >
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
              {categoryDescription ? (
                <div className="relative flex w-full flex-col rounded-2xl border border-border/60 bg-surface/70 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                  <div className="prose dark:prose-invert max-w-none game-copy text-foreground">
                    <p className="whitespace-pre-line">{categoryDescription}</p>
                  </div>
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-surface/90 to-transparent" />
                </div>
              ) : null}
              <div className="flex flex-col gap-5">
                {group.sections.map((section) => (
                  <div key={`${group.topCode}-${section.code}`} className="space-y-3">
                    {!section.code.endsWith(".0") ? (
                      <div className="space-y-1 px-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                            {section.code}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{section.name}</span>
                        </div>
                        <div className="h-px w-full bg-border/60" />
                      </div>
                    ) : null}
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
                              onChange={() => toggleItem(item)}
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
                              <span className="absolute inset-0 rounded-[5px] bg-white dark:bg-background" />
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
                              {(() => {
                                const { label, href } = parseTitleLink(item.title);
                                if (href) {
                                  return (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={clsx(
                                        "font-semibold text-foreground underline decoration-accent/70 underline-offset-2",
                                        isChecked ? "line-through decoration-2" : undefined
                                      )}
                                    >
                                      {label}
                                    </a>
                                  );
                                }
                                return (
                                  <div
                                    className={clsx(
                                      "font-semibold text-foreground",
                                      isChecked ? "line-through decoration-2" : undefined
                                    )}
                                  >
                                    {label}
                                  </div>
                                );
                              })()}
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
            </section>
          );

          if (!shouldInsertGroupAd(index, groupedSections.length)) {
            return [sectionNode];
          }

          return [
            sectionNode,
            <ContentSlot
              key={`mobile-ad-${group.topCode}`}
              slot="1348288339"
              className="w-full"
              adLayout={null}
              adFormat="auto"
              fullWidthResponsive
            />
          ];
        })}
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "relative w-full max-w-full min-w-0 overflow-hidden pb-6",
        computedClassName
      )}
      style={{ height: availableHeight || undefined }}
    >
      <div
        ref={containerRef}
        className="flex h-full w-full min-w-0 gap-6 overflow-x-auto overflow-y-hidden py-3 pb-16 touch-pan-x [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Left Arrow */}
        <button
          onClick={() => scrollByArrow("left")}
          className={clsx(
            "fixed left-6 top-1/2 z-50 -translate-y-1/2 rounded-full border border-border/40 bg-surface/80 p-3 text-foreground backdrop-blur-md transition-all duration-300 hover:bg-surface hover:shadow-lg active:scale-95",
            showLeftArrow ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
          )}
          aria-label="Scroll left"
        >
          <FiChevronLeft className="h-6 w-6" />
        </button>

        {/* Right Arrow */}
        <button
          onClick={() => scrollByArrow("right")}
          className={clsx(
            "fixed right-6 top-1/2 z-50 -translate-y-1/2 rounded-full border border-border/40 bg-surface/80 p-3 text-foreground backdrop-blur-md transition-all duration-300 hover:bg-surface hover:shadow-lg active:scale-95",
            showRightArrow ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          )}
          aria-label="Scroll right"
        >
          <FiChevronRight className="h-6 w-6" />
        </button>
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
            const adWidth = isLargeScreen ? 400 : 320;

            return groups.flatMap((group, index) => {
              const progress = progressByTopCode[group.topCode] ?? { total: 0, done: 0, percent: 0 };
              const categoryDescription = categoryDescriptions.get(group.topCode);

              const groupNode = (
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
                      {(() => {
                        // Group consecutive columns by section
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

                        return sectionGroups.map((sg, sgIdx) => {
                          const colCount = sg.cols.length || 1;
                          const colWidth = isLargeScreen ? 400 : 320;
                          const gapWidth = 28; // gap-7
                          const spanWidth = colCount * colWidth + Math.max(0, colCount - 1) * gapWidth;

                          return (
                            <div
                              key={`${group.topCode}-${sg.code}-${sgIdx}`}
                              className="flex flex-col gap-3 shrink-0"
                              style={{ minWidth: `${spanWidth}px` }}
                            >
                              {/* Section header spanning all columns - only show if section is split across multiple columns */}
                              {sg.cols.length > 1 && !sg.code.endsWith(".0") && (
                                <div className="space-y-1 px-1">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                                      {sg.code}
                                    </span>
                                    <span className="text-sm font-semibold text-foreground">{sg.name}</span>
                                  </div>
                                  <div className="h-px w-full bg-border/60" />
                                </div>
                              )}

                              {/* Columns underneath */}
                              <div className="flex gap-7">
                                {sg.cols.map((column, idx) => (
                                  <div
                                    key={`${column.topCode}-${sg.code}-${idx}`}
                                    className="flex shrink-0 flex-col gap-5"
                                    style={{ width: colWidth }}
                                  >
                                    <div className="flex flex-1 flex-col gap-5 overflow-hidden">
                                      {column.sections.map((section) => (
                                        <div
                                          key={section.chunkKey}
                                          ref={setSectionRef(section.chunkKey)}
                                          className="space-y-3"
                                        >
                                          {/* Show section header only if section is NOT split across multiple columns */}
                                          {!section.continuation && sg.cols.length === 1 && !sg.code.endsWith(".0") && (
                                            <div className="space-y-1 px-1">
                                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                                <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted">
                                                  {section.code}
                                                </span>
                                                <span className="text-sm font-semibold text-foreground">{section.name}</span>
                                              </div>
                                              <div className="h-px w-full bg-border/60" />
                                            </div>
                                          )}
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
                                                    onChange={() => toggleItem(item)}
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
                                                    <span className="absolute inset-0 rounded-[5px] bg-white dark:bg-background" />
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
                                                    {(() => {
                                                      const { label, href } = parseTitleLink(item.title);
                                                      if (href) {
                                                        return (
                                                          <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className={clsx(
                                                              "font-semibold text-foreground underline decoration-accent/70 underline-offset-2",
                                                              isChecked ? "line-through decoration-2" : undefined
                                                            )}
                                                          >
                                                            {label}
                                                          </a>
                                                        );
                                                      }
                                                      return (
                                                        <div
                                                          className={clsx(
                                                            "font-semibold text-foreground",
                                                            isChecked ? "line-through decoration-2" : undefined
                                                          )}
                                                        >
                                                          {label}
                                                        </div>
                                                      );
                                                    })()}
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
                        });
                      })()}
                    </div>
                  </div>
                </div>
              );

              if (!shouldInsertGroupAd(index, groups.length)) {
                return [groupNode];
              }

              return [
                groupNode,
                <div
                  key={`group-ad-${group.topCode}`}
                  className="flex shrink-0 items-start"
                  style={{ width: adWidth }}
                >
                  <ContentSlot
                    slot="1348288339"
                    className="w-full"
                    adLayout={null}
                    adFormat="auto"
                    fullWidthResponsive
                  />
                </div>
              ];
            });
          })()
        )}
      </div>
    </div>
  );
}
