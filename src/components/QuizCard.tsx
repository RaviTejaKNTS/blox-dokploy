"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type QuizCardProps = {
  code: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
};

function formatUpdatedLabel(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  try {
    return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

export function QuizCard({ code, title, summary, universeName, coverImage, updatedAt }: QuizCardProps) {
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const fallbackImage = "/og-image.png";

  return (
    <Link
      href={`/quizzes/${code}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface to-surface/60 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/70 hover:shadow-lg"
    >
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-sky-500/10 blur-3xl transition duration-500 group-hover:bg-sky-500/20" />
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-500">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/70 bg-sky-500/10 text-xs">
          ?
        </span>
        <span>Quiz</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-surface/80">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt={universeName || title}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.src.endsWith(fallbackImage)) return;
                  event.currentTarget.src = fallbackImage;
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted/60">🎯</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{universeName ?? "Roblox"}</p>
            <h3 className="text-base font-semibold leading-tight text-foreground line-clamp-2 md:text-lg">{title}</h3>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted leading-relaxed line-clamp-3">{summary}</div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            <span>15 questions</span>
            <span>5 easy · 5 medium · 5 hard</span>
          </div>
          {updatedLabel ? <div className="text-xs text-muted">Updated {updatedLabel}</div> : null}
        </div>
      </div>
    </Link>
  );
}
