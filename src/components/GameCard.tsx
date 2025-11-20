import Image from "next/image";
import Link from "next/link";
import type { GameWithCounts } from "@/lib/db";
import { FiClock } from "react-icons/fi";
import { formatUpdatedLabel } from "@/lib/updated-label";

const baseCardClass =
  "group overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface transition-colors flex flex-col";
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwMCcgaGVpZ2h0PSc1NjInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEwMDAnIGhlaWdodD0nNTYyJyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

type GameCardProps = {
  game: GameWithCounts;
  className?: string;
  titleAs?: "h2" | "p";
  priority?: boolean;
  articleUpdatedAt?: string | null;
};

export function GameCard({
  game,
  className,
  titleAs: Title = "h2",
  priority,
  articleUpdatedAt,
}: GameCardProps) {
  const classes = className ? `${baseCardClass} ${className}` : baseCardClass;
  const updatedLabel = formatUpdatedLabel(articleUpdatedAt);

  return (
    <div className={`${classes} hover:border-accent hover:shadow-[0_24px_45px_-35px_rgba(59,70,128,0.65)]`}>
      <Link href={`/codes/${game.slug}`} prefetch={false} className="flex flex-1 flex-col">
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
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex min-h-[3.5rem] items-start">
            <Title className="line-clamp-2 text-lg font-semibold leading-snug text-foreground group-hover:text-accent">
              {game.name} Codes
            </Title>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted">
        <span className="inline-flex items-center gap-2 text-foreground/80">
          <span className="inline-flex h-2 w-2 rounded-full bg-green-400" aria-hidden />
          <span>
            {game.active_count} {game.active_count === 1 ? "active code" : "active codes"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <FiClock aria-hidden className="h-3 w-3 text-muted/80" />
          <span>{updatedLabel ?? "recently"}</span>
        </span>
      </div>
    </div>
  );
}
