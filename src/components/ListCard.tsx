import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type ListCardProps = {
  title: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  updatedAt?: string | null;
  itemsCount?: number | null;
};

export function ListCard({ title, slug, description, coverImage, updatedAt, itemsCount }: ListCardProps) {
  const updatedLabel = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
    : null;

  return (
    <Link
      href={`/lists/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/70 shadow-soft transition hover:-translate-y-1 hover:shadow-lg hover:border-accent/60"
    >
      {coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-muted/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-accent truncate" title={title}>
              {title}
            </h3>
            {itemsCount != null ? (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80">
                {itemsCount} {itemsCount === 1 ? "game" : "games"}
              </p>
            ) : null}
          </div>
          <span className="rounded-full border border-border/70 bg-surface-muted/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted group-hover:border-accent/50 group-hover:text-accent">
            View
          </span>
        </div>

        {description ? (
          <p className="line-clamp-3 text-sm text-muted leading-relaxed">{description}</p>
        ) : null}

        {updatedLabel ? (
          <p className="text-xs text-muted">Updated {updatedLabel}</p>
        ) : null}
      </div>
    </Link>
  );
}
