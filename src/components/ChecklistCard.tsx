import Link from "next/link";
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
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const tasksLabel = typeof itemsCount === "number" ? `${itemsCount} step${itemsCount === 1 ? "" : "s"}` : "Checklist";

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
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
              {universeName ? universeName : "Roblox Experience"}
            </p>
            <h3 className="text-lg font-semibold leading-tight text-foreground line-clamp-2">{title}</h3>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-dashed border-emerald-400/50 bg-emerald-500/5 p-3">
          <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent" />
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400 bg-white/70 text-[10px] text-emerald-600 shadow-sm">
              ✓
            </span>
            <span>{tasksLabel}</span>
          </div>
          <div className="mt-2 text-sm text-muted leading-relaxed line-clamp-3">{summary}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-emerald-700/80">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ready to tick off
            </span>
            {updatedLabel ? <span className="text-muted">Updated {updatedLabel}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
