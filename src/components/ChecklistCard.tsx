"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

type ChecklistCardProps = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
};

type Progress = { done: number; total: number; percent: number };

function formatUpdatedLabel(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  try {
    return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

function storageKey(slug: string) {
  return `checklist:${slug}`;
}

function computeProgress(slug: string, totalItems: number): Progress {
  let done = 0;
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        done = parsed.filter((id) => typeof id === "string").length;
      }
    }
  } catch {
    // ignore storage errors
  }
  const clampedDone = Math.min(done, totalItems);
  return {
    done: clampedDone,
    total: totalItems,
    percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
  };
}

export function ChecklistCard({
  slug,
  title,
  summary,
  universeName,
  coverImage,
  updatedAt,
  itemsCount
}: ChecklistCardProps) {
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const totalItems = typeof itemsCount === "number" ? itemsCount : 0;
  const [progress, setProgress] = useState<Progress>(() => ({
    done: 0,
    total: totalItems,
    percent: totalItems ? 0 : 0
  }));

  useEffect(() => {
    setProgress(computeProgress(slug, totalItems));
  }, [slug, totalItems]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey(slug)) {
        setProgress(computeProgress(slug, totalItems));
      }
    };
    const handleProgressEvent = (event: Event) => {
      const custom = event as CustomEvent<{ slug: string; checkedCount: number; totalCount: number }>;
      const detail = custom.detail;
      if (!detail || detail.slug !== slug) return;
      const total = totalItems || detail.totalCount || 0;
      const done = Math.min(detail.checkedCount, total);
      setProgress({
        done,
        total,
        percent: total ? Math.round((done / total) * 100) : 0
      });
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("checklist-progress", handleProgressEvent as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
    };
  }, [slug, totalItems]);

  return (
    <Link
      href={`/checklists/${slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface to-surface/60 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/70 hover:shadow-lg"
    >
      <div className="absolute left-0 top-0 h-32 w-32 -translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/10 blur-3xl transition duration-500 group-hover:bg-emerald-500/20" />
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-500">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/10 text-xs">
          ✓
        </span>
        <span>Checklist</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-surface/80">
            {coverImage ? (
              <img
                src={coverImage}
                alt={universeName || title}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted/60">🎯</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"></p>
            <h3 className="text-base font-semibold leading-tight text-foreground line-clamp-2 md:text-lg">{title}</h3>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted leading-relaxed line-clamp-3">{summary}</div>
          <div className="text-[11px] font-semibold text-muted">
            {progress.total > 0
              ? `${progress.done}/${progress.total} tasks done · ${progress.percent}% complete`
              : `${totalItems} ${totalItems === 1 ? "task" : "tasks"}`}
          </div>
        </div>
      </div>
    </Link>
  );
}
