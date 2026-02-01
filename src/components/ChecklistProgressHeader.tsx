"use client";

import { useEffect, useState } from "react";
import { readLocalChecklistProgress, useChecklistSession } from "@/lib/checklist-progress-client";

type Progress = { done: number; total: number; percent: number };

type ChecklistProgressHeaderProps = {
  title: string;
  slug: string;
  totalItems: number;
};

function computeProgress(slug: string, totalItems: number): Progress {
  const done = readLocalChecklistProgress(slug).length;
  const clampedDone = Math.min(done, totalItems);
  return {
    done: clampedDone,
    total: totalItems,
    percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
  };
}

export function ChecklistProgressHeader({ title, slug, totalItems }: ChecklistProgressHeaderProps) {
  const session = useChecklistSession();
  const [progress, setProgress] = useState<Progress>(() => ({
    done: 0,
    total: totalItems,
    percent: totalItems ? 0 : 0
  }));

  useEffect(() => {
    if (session.status !== "ready" || session.userId) return;
    setProgress(computeProgress(slug, totalItems));
  }, [session.status, session.userId, slug, totalItems]);

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

    window.addEventListener("checklist-progress", handleProgressEvent as EventListener);
    if (!session.userId) {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `checklist:${slug}`) {
          setProgress(computeProgress(slug, totalItems));
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
        window.removeEventListener("storage", handleStorage);
      };
    }
    return () => {
      window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
    };
  }, [session.userId, slug, totalItems]);

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-border/70 sm:flex-1"
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
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/70 px-3 py-[6px] text-[11px] font-semibold text-muted-foreground shadow-sm whitespace-nowrap sm:self-auto">
        <span className="text-foreground">{progress.done}/{progress.total}</span>
        <span>tasks done</span>
        <span className="text-border">.</span>
        <span className="text-foreground">{progress.percent}%</span>
        <span>complete</span>
      </div>
    </div>
  );
}
