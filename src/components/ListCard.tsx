import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type ListCardProps = {
  displayName: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  updatedAt?: string | null;
  itemsCount?: number | null;
  variant?: "default" | "sidebar";
};

export function ListCard({
  displayName,
  title,
  slug,
  coverImage,
  updatedAt,
  itemsCount: _itemsCount,
  variant = "default"
}: ListCardProps) {
  const updatedLabel = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : null;
  const heroImage = coverImage ?? null;

  if (variant === "sidebar") {
    return (
      <Link href={`/lists/${slug}`} className="group block">
        <div className="flex items-center gap-3 rounded-lg">
          <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-surface-muted/70 shrink-0">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={displayName || title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-muted" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent" title={displayName}>
              {displayName || title}
            </h3>
            {updatedLabel ? <p className="text-xs text-muted">Updated {updatedLabel}</p> : null}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/lists/${slug}`}
      className="group block overflow-hidden rounded-lg border border-border/40 bg-surface/80 shadow-soft transition hover:shadow-xl hover:border-accent/60"
    >
      <div className="relative aspect-[1200/675] w-full overflow-hidden bg-surface-muted/60">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={displayName || title}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-muted" />
        )}
        <div className="absolute inset-0 bg-black/70 mix-blend-multiply transition duration-500 group-hover:bg-black/80" />
        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
            {updatedLabel ? <span className="text-white/70">Updated {updatedLabel}</span> : null}
          </div>
          <h3 className="text-2xl font-semibold text-white drop-shadow-md" title={displayName}>
            {displayName}
          </h3>
        </div>
      </div>
    </Link>
  );
}
