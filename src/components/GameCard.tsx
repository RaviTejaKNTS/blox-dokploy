import Image from "next/image";
import Link from "next/link";
import type { GameWithCounts } from "@/lib/db";
import { FiClock } from "react-icons/fi";
import { formatUpdatedLabel } from "@/lib/updated-label";

const baseCardClass = "group overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface transition-colors flex flex-col";
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwMCcgaGVpZ2h0PSc1NjInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEwMDAnIGhlaWdodD0nNTYyJyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

type GameCardProps = {
  game: GameWithCounts;
  className?: string;
  titleAs?: 'h2' | 'p';
  priority?: boolean;
  articleUpdatedAt?: string | null;
};

export function GameCard({
  game,
  className,
  titleAs: Title = 'h2',
  priority,
  articleUpdatedAt,
}: GameCardProps) {
  const classes = className ? `${baseCardClass} ${className}` : baseCardClass;
  const updatedLabel = formatUpdatedLabel(articleUpdatedAt);

  return (
    <Link
      href={`/${game.slug}`}
      prefetch={false}
      className={`${classes} hover:border-accent hover:shadow-[0_24px_45px_-35px_rgba(59,70,128,0.65)]`}
    >
      <div className="relative aspect-[16/9] bg-surface-muted">
        {game.cover_image ? (
          <Image
            src={game.cover_image.startsWith("http") ? game.cover_image : `/` + game.cover_image.replace(/^\//, "")}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted">{game.name}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Title className="font-semibold text-lg text-foreground group-hover:text-accent">{game.name} Codes</Title>
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex h-2 w-2 rounded-full bg-green-400" aria-hidden />
          <span>
            {game.active_count} {game.active_count === 1 ? "active code" : "active codes"}
          </span>
          {updatedLabel ? (
            <span className="flex items-center gap-1 whitespace-nowrap text-muted">
              <span aria-hidden className="text-border/60">·</span>
              <FiClock aria-hidden className="h-3 w-3 text-muted/80" />
              <span>{updatedLabel}</span>
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
