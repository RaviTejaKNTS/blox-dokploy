import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { listGamesWithActiveCounts } from "@/lib/db";
import { monthYear } from "@/lib/date";
import { GameSearch } from "@/components/GameSearch";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 30;

const PAGE_TITLE = `${SITE_NAME} Roblox Codes (${monthYear()})`;
const PAGE_DESCRIPTION =
  "Bloxodes curates working Roblox promo codes, expiry alerts, and redemption tips for the most-played experiences. Check fresh rewards, filter by game, and stay ahead of the next drop.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "Roblox codes",
    "Roblox promo codes",
    "free Roblox rewards",
    "Bloxodes",
    "updated Roblox codes"
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Roblox Codes`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`]
  }
};

export default async function HomePage() {
  const games = await listGamesWithActiveCounts();
  const totalActiveCodes = games.reduce((sum, game) => sum + (game.active_count ?? 0), 0);
  const mostRecentGame = games[0];
  const mostRecentUpdate = mostRecentGame
    ? new Date(mostRecentGame.latest_code_first_seen_at ?? mostRecentGame.updated_at)
    : null;
  const refreshedLabel = mostRecentUpdate
    ? formatDistanceToNow(mostRecentUpdate, { addSuffix: true })
    : null;
  const featuredGames = games.slice(0, 6);
  const gamesByUpdatedAt = [...games].sort((a, b) => {
    const aTime = new Date(a.updated_at).getTime();
    const bTime = new Date(b.updated_at).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Trending Roblox Code Guides",
    description: SITE_DESCRIPTION,
    itemListElement: games.slice(0, 12).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${game.name} codes`,
      url: `${SITE_URL}/${game.slug}`,
      dateModified: game.latest_code_first_seen_at ?? game.updated_at
    }))
  });

  return (
    <section className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Codes Hub</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Fresh Roblox game codes, updated as soon as they drop
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          {PAGE_DESCRIPTION}
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

      {featuredGames.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Recently updated Roblox code guides</h2>
          <p className="text-sm text-muted md:text-base">
            Jump straight to the hottest drops the community is chasing right now.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredGames.map((game) => (
              <li key={game.id} className="rounded-[var(--radius-lg)] border border-border/50 bg-surface-muted p-4 transition hover:border-accent/60 hover:shadow-lg">
                <Link href={`/${game.slug}`} className="flex flex-col gap-2 text-left">
                  <span className="text-sm font-semibold uppercase tracking-wide text-accent/80">
                    Updated {formatDistanceToNow(
                      new Date(game.latest_code_first_seen_at ?? game.updated_at),
                      { addSuffix: true }
                    )}
                  </span>
                  <span className="text-xl font-semibold text-foreground">{game.name}</span>
                  <span className="text-sm text-muted">
                    {game.active_count > 0
                      ? `${game.active_count} active ${game.active_count === 1 ? "code" : "codes"} + redemption tips`
                      : "Check status, expiry history, and redeem instructions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Search the full Roblox codes library</h2>
        <GameSearch games={gamesByUpdatedAt} />
      </section>
    </section>
  );
}
