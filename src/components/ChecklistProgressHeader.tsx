"use client";

import { useEffect, useState } from "react";

type Progress = { done: number; total: number; percent: number };

type ChecklistProgressHeaderProps = {
  title: string;
  slug: string;
  totalItems: number;
};

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

export function ChecklistProgressHeader({ title, slug, totalItems }: ChecklistProgressHeaderProps) {
  const [progress, setProgress] = useState<Progress>(() => ({
    done: 0,
    total: totalItems,
    percent: totalItems ? 0 : 0
  }));

  useEffect(() => {
    setProgress(computeProgress(slug, totalItems));
  }, [slug, totalItems]);

  useEffect(() => {
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

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey(slug)) {
        setProgress(computeProgress(slug, totalItems));
      }
    };

    window.addEventListener("checklist-progress", handleProgressEvent as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [slug, totalItems]);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-black leading-tight sm:text-[26px]">{title}</h1>
      <div className="flex items-center gap-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-border/70"
          role="progressbar"
          aria-label={`Overall progress for ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="min-w-[64px] text-right text-xs font-semibold text-muted-foreground">
          {progress.done}/{progress.total}
        </div>
      </div>
    </div>
  );
}
