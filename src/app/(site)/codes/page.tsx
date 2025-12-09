import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { listGamesWithActiveCounts } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { GameCard } from "@/components/GameCard";

export const revalidate = 86400; // daily

export const metadata: Metadata = {
  title: "Roblox Game Codes",
  description: `${SITE_NAME} tracks active codes across Roblox games. Explore every game we cover here.`,
};

export default async function CodesIndexPage() {
  const games = await listGamesWithActiveCounts();
  const sortedGames = [...games].sort((a, b) => {
    const aTime = new Date(a.content_updated_at ?? a.updated_at).getTime();
    const bTime = new Date(b.content_updated_at ?? b.updated_at).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
  const totalActiveCodes = games.reduce((sum, game) => sum + (game.active_count ?? 0), 0);
  const mostRecentGame = sortedGames[0];
  const mostRecentUpdate = mostRecentGame
    ? new Date(mostRecentGame.content_updated_at ?? mostRecentGame.updated_at)
    : null;
  const refreshedLabel = mostRecentUpdate
    ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true })
    : null;

  return (
    <div className="space-y-10">
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
            Tracking {games.length} games · {totalActiveCodes} active rewards
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Games we cover</h2>
          <p className="text-sm text-muted">
            {games.length
              ? `${games.length} Roblox games tracked`
              : "Games will appear here once they are published."}
          </p>
        </div>

        {games.length === 0 ? (
          <p className="text-sm text-muted">We haven’t published any game code pages yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                priority={index < 2}
                articleUpdatedAt={game.content_updated_at ?? game.updated_at ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Game Codes",
            description: `${SITE_NAME} tracks active codes across Roblox games. Explore every game we cover here.`,
            url: `${SITE_URL}/codes`
          })
        }}
      />
    </div>
  );
}
