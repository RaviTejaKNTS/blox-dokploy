"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  readLocalChecklistProgress,
  useChecklistProgressIndex,
  useChecklistSession
} from "@/lib/checklist-progress-client";

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

export function ChecklistCard({
  slug,
  title,
  summary,
  universeName,
  coverImage,
  updatedAt,
  itemsCount
}: ChecklistCardProps) {
  const session = useChecklistSession();
  const progressIndex = useChecklistProgressIndex(session.status === "ready" ? session.userId : null);
  const accountDone =
    session.userId && progressIndex.userId === session.userId ? (progressIndex.counts[slug] ?? 0) : 0;
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const totalItems = typeof itemsCount === "number" ? itemsCount : 0;
  const [localVersion, setLocalVersion] = useState(0);
  const fallbackImage = "/og-image.png";
  const handleImgError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src.endsWith(fallbackImage)) return;
    event.currentTarget.src = fallbackImage;
  };

  const progress = useMemo<Progress>(() => {
    if (session.status !== "ready") {
      return { done: 0, total: totalItems, percent: totalItems ? 0 : 0 };
    }
    if (session.userId) {
      const clampedDone = Math.min(accountDone, totalItems);
      return {
        done: clampedDone,
        total: totalItems,
        percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
      };
    }
    const localDone = readLocalChecklistProgress(slug).length;
    const clampedDone = Math.min(localDone, totalItems);
    return {
      done: clampedDone,
      total: totalItems,
      percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
    };
  }, [session.status, session.userId, accountDone, slug, totalItems, localVersion]);

  useEffect(() => {
    if (!session.userId) {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `checklist:${slug}`) {
          setLocalVersion((prev) => prev + 1);
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("storage", handleStorage);
      };
    }
    return () => {
      // no-op
    };
  }, [session.userId, slug]);

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
                onError={handleImgError}
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
