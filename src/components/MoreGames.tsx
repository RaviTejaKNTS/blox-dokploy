"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "@/components/GameCard";
import type { GameWithCounts } from "@/lib/db";

type MoreGamesProps = {
  games: Array<{
    data: GameWithCounts;
    articleUpdatedAt: string | null;
  }>;
  step: number;
};

export function MoreGames({ games, step }: MoreGamesProps) {
  const [shown, setShown] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setShown((current) => Math.min(current + step, games.length));
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [games.length, step]);

  useEffect(() => {
    setShown(step);
  }, [games, step]);

  const visible = useMemo(() => games.slice(0, shown), [games, shown]);
  const hasMore = shown < games.length;

  if (!games.length) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map(({ data: game, articleUpdatedAt }) => (
          <GameCard key={game.id} game={game} articleUpdatedAt={articleUpdatedAt} />
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-2 text-xs text-muted">
            Loading more games…
          </span>
        </div>
      ) : null}
    </div>
  );
}
