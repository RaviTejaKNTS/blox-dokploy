import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import type { GameWithCounts } from "@/lib/db";
import { FiClock } from "react-icons/fi";

const baseCardClass = "group overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface transition-colors flex flex-col";

type GameCardProps = {
  game: GameWithCounts;
  className?: string;
  titleAs?: 'h2' | 'p';
  priority?: boolean;
};

export function GameCard({ game, className, titleAs: Title = 'h2', priority }: GameCardProps) {
  const classes = className ? `${baseCardClass} ${className}` : baseCardClass;
  const lastUpdatedAt = game.latest_code_first_seen_at ?? game.updated_at;
  const updatedLabel = lastUpdatedAt
    ? formatDistanceToNowStrict(new Date(lastUpdatedAt), { addSuffix: true })
    : null;

  return (
    <Link
      href={`/${game.slug}`}
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
