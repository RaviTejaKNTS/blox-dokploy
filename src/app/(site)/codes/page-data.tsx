import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { listGamesWithActiveCountsPage, type GameWithCounts } from "@/lib/db";
import { CODES_DESCRIPTION, SITE_URL, buildAlternates } from "@/lib/seo";
import { GameCard } from "@/components/GameCard";
import { PagePagination } from "@/components/PagePagination";

export const CODES_PAGE_SIZE = 20;

export type CodesPageData = {
  games: GameWithCounts[];
  total: number;
  totalPages: number;
};

export async function loadCodesPageData(pageNumber: number): Promise<CodesPageData> {
  const { games, total } = await listGamesWithActiveCountsPage(pageNumber, CODES_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / CODES_PAGE_SIZE));
  return { games, total, totalPages };
}

function CodesPageView({
  games,
  totalGames,
  totalPages,
  currentPage,
  showHero
}: {
  games: GameWithCounts[];
  totalGames: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
}) {
  const mostRecentGame = games[0];
  const mostRecentUpdate = mostRecentGame
    ? new Date(mostRecentGame.content_updated_at ?? mostRecentGame.updated_at)
    : null;
  const refreshedLabel = mostRecentUpdate ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Codes Hub</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Fresh Roblox game codes, updated as soon as they drop
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Find the latest Roblox codes for all your favorite games in one place. Updated daily with active promo codes, rewards, and
            freebies to help you unlock items, boosts, and more.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
            <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
              Tracking {totalGames} games
            </span>
            {refreshedLabel ? (
              <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
                Last updated {refreshedLabel}
              </span>
            ) : null}
          </div>
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Roblox Codes</p>
          <h1 className="text-3xl font-semibold text-foreground">Roblox game codes</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Games we cover</h2>
          <p className="text-sm text-muted">
            {games.length ? `${totalGames} Roblox games tracked` : "Games will appear here once they are published."}
          </p>
        </div>

        {games.length === 0 ? (
          <p className="text-sm text-muted">We haven’t published any game code pages yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game, index) => (
              <div
                key={game.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="codes_index"
                data-analytics-item-id={game.slug}
                data-analytics-item-name={game.name}
                data-analytics-position={index + 1}
                data-analytics-content-type="codes"
              >
                <GameCard
                  game={game}
                  priority={showHero && index < 2}
                  articleUpdatedAt={game.content_updated_at ?? game.updated_at ?? null}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <PagePagination basePath="/codes" currentPage={currentPage} totalPages={totalPages} />

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Roblox Game Codes",
              description: CODES_DESCRIPTION,
              url: `${SITE_URL}/codes`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export function renderCodesPage(props: Parameters<typeof CodesPageView>[0]) {
  return <CodesPageView {...props} />;
}

export const codesMetadata: Metadata = {
  title: "Roblox Game Codes",
  description: CODES_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/codes`)
};
