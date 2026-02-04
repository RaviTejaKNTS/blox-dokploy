import Image from "next/image";
import Link from "next/link";

type EventCounts = {
  upcoming: number;
  current: number;
  past: number;
};

export type EventsPageCardProps = {
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  fallbackIcon: string | null;
  eventName: string | null;
  eventTimeLabel: string | null;
  status: "upcoming" | "current" | "past" | "none";
  counts: EventCounts;
  updatedLabel: string | null;
};

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTIwMCcgaGVpZ2h0PSc2NzUnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEyMDAnIGhlaWdodD0nNjc1JyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

const STATUS_STYLES = {
  upcoming: {
    label: "Next event",
    badge: "bg-accent/90 text-white",
    dot: "bg-accent"
  },
  current: {
    label: "Live now",
    badge: "bg-emerald-500/90 text-white",
    dot: "bg-emerald-400"
  },
  past: {
    label: "Recent event",
    badge: "bg-amber-400/90 text-slate-900",
    dot: "bg-amber-400"
  },
  none: {
    label: "Events hub",
    badge: "bg-surface-muted text-foreground",
    dot: "bg-muted"
  }
} as const;

function normalizeImageUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function buildCountsLabel(counts: EventCounts) {
  const upcoming = counts.upcoming ?? 0;
  const current = counts.current ?? 0;
  const past = counts.past ?? 0;
  const total = upcoming + current + past;
  if (!total) return "Events tracked";
  if (upcoming || current) {
    return `${upcoming} upcoming · ${current} live`;
  }
  return `${past} past ${past === 1 ? "event" : "events"}`;
}

export function EventsPageCard({
  slug,
  title,
  summary,
  universeName,
  coverImage,
  fallbackIcon,
  eventName,
  eventTimeLabel,
  status,
  counts,
  updatedLabel
}: EventsPageCardProps) {
  const displayUniverse = universeName ?? "Roblox";
  const normalizedCover = normalizeImageUrl(coverImage);
  const normalizedIcon = normalizeImageUrl(fallbackIcon);
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.none;
  const countsLabel = buildCountsLabel(counts);
  const totalEvents = (counts.upcoming ?? 0) + (counts.current ?? 0) + (counts.past ?? 0);
  const fallbackTitle = eventName || title || "Events overview";
  const timeLabel =
    eventTimeLabel ??
    (totalEvents > 0 ? "Schedules and countdowns" : "No scheduled events yet");

  return (
    <Link href={`/events/${slug}`} prefetch={false} className="group block h-full">
      <article className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent/70 hover:shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 transition duration-700 group-hover:opacity-100"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(15,23,42,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(15,23,42,0.1),transparent_35%)] dark:bg-[radial-gradient(circle_at_12%_18%,rgba(79,70,229,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.14),transparent_35%)]" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/10 via-transparent to-slate-950/20 dark:from-background/40 dark:to-background/80" />
        </div>

        <div className="relative">
          <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
            {normalizedCover ? (
              <Image
                src={normalizedCover}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition duration-700 group-hover:scale-105"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface-muted via-surface to-background/80 px-6 text-center">
                {normalizedIcon ? (
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-inner">
                    <Image src={normalizedIcon} alt={displayUniverse} fill sizes="56px" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-sm font-semibold text-muted">
                    EV
                  </div>
                )}
                <span className="text-sm font-semibold text-foreground">{displayUniverse}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent dark:from-background/95 dark:via-background/40" />
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${statusStyle.badge}`}>
                {statusStyle.label}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 space-y-1">
              <p className="text-base font-semibold text-white drop-shadow-sm line-clamp-1">{fallbackTitle}</p>
              <p className="text-xs text-white/80">{timeLabel}</p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-4 p-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{displayUniverse}</p>
            <h3 className="text-lg font-semibold leading-snug text-foreground transition group-hover:text-accent line-clamp-2">
              {title}
            </h3>
          </div>
          <p className="text-sm text-muted leading-relaxed line-clamp-3">{summary}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} aria-hidden />
              {countsLabel}
            </span>
            {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
