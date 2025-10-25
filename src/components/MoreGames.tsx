"use client";

import { useEffect, useMemo, useState } from "react";
import { GameCard } from "@/components/GameCard";
import type { GameWithCounts } from "@/lib/db";

type MoreGamesProps = {
  games: Array<{
    data: GameWithCounts;
    articleUpdatedAt: string | null;
  }>;
};

const ROWS_PER_PAGE = 3;

const BREAKPOINTS: Array<{ query: string; columns: number }> = [
  { query: "(min-width: 1280px)", columns: 4 },
  { query: "(min-width: 1024px)", columns: 3 },
  { query: "(min-width: 640px)", columns: 2 },
];

function getCardsPerRow(): number {
  if (typeof window === "undefined") {
    return 4;
  }
  for (const bp of BREAKPOINTS) {
    if (window.matchMedia(bp.query).matches) {
      return bp.columns;
    }
  }
  return 1;
}

export function MoreGames({ games }: MoreGamesProps) {
  const [cardsPerRow, setCardsPerRow] = useState(getCardsPerRow);
  const [rowsVisible, setRowsVisible] = useState(ROWS_PER_PAGE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setCardsPerRow(getCardsPerRow());
    update();
    const media = BREAKPOINTS.map((bp) => window.matchMedia(bp.query));
    media.forEach((mql) => mql.addEventListener("change", update));
    return () => {
      media.forEach((mql) => mql.removeEventListener("change", update));
    };
  }, []);

  const maxRows = Math.ceil(games.length / cardsPerRow);
  const clampedRowsVisible = Math.min(rowsVisible, maxRows);
  const visibleCount = Math.min(cardsPerRow * clampedRowsVisible, games.length);

  const visible = useMemo(() => games.slice(0, visibleCount), [games, visibleCount]);
  const hasMore = clampedRowsVisible < maxRows;

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
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setRowsVisible((rows) => Math.min(rows + ROWS_PER_PAGE, maxRows))}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-5 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Load more games
          </button>
        </div>
      ) : null}
    </div>
  );
}
