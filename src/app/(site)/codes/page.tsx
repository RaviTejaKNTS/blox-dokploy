import type { Metadata } from "next";
import { listGamesWithActiveCounts } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";
import { GameCard } from "@/components/GameCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Roblox Game Codes",
  description: `${SITE_NAME} tracks active codes across Roblox games. Explore every game we cover here.`,
};

export default async function CodesIndexPage() {
  const games = await listGamesWithActiveCounts();

  return (
    <div className="space-y-10">
      <header className="rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">All Roblox Game Codes</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Browse every Roblox experience we monitor for active codes. Each game card shows the freshest update time so you know what was
          checked recently.
        </p>
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
    </div>
  );
}
