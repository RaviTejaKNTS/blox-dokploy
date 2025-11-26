import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { formatDistanceToNow } from "date-fns";
import { listGamesWithActiveCounts, listPublishedArticles } from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { GameCard } from "@/components/GameCard";
import { ArticleCard } from "@/components/ArticleCard";

const INITIAL_FEATURED_COUNT = 12;

const LazyMoreGames = dynamic(() => import("@/components/MoreGames").then((mod) => mod.MoreGames), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-6 text-sm text-muted">Preparing more games…</div>
  )
});

export const revalidate = 21600; // 6 hours

const PAGE_TITLE = `${SITE_NAME} — Check Latest Roblox Game Codes`;
const PAGE_DESCRIPTION =
  "Find the latest Roblox codes for all your favorite games in one place. Updated daily with active promo codes, rewards, and freebies to help you unlock items, boosts, and more.";

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
        url: `${SITE_URL}/Bloxodes.png`,
        width: 1200,
        height: 675,
        alt: PAGE_TITLE
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/Bloxodes.png`]
  }
};

export default async function HomePage() {
  const games = await listGamesWithActiveCounts();
  const articles = await listPublishedArticles(9);
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
  const gamesByUpdatedAt = sortedGames;

  const featuredGames = gamesByUpdatedAt.slice(0, INITIAL_FEATURED_COUNT).map((game) => ({
    data: game,
    articleUpdatedAt: game.content_updated_at ?? game.updated_at ?? null
  }));

  const remainingGames = gamesByUpdatedAt.slice(INITIAL_FEATURED_COUNT).map((game) => ({
    data: game,
    articleUpdatedAt: game.content_updated_at ?? game.updated_at ?? null
  }));

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Trending Roblox Code Guides",
    description: SITE_DESCRIPTION,
    itemListElement: games.slice(0, 12).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${game.name} codes`,
      url: `${SITE_URL}/codes/${game.slug}`,
      dateModified: game.content_updated_at ?? game.updated_at
    }))
  });

  return (
    <section className="space-y-4">
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

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Trending Roblox games</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featuredGames.map(({ data: game, articleUpdatedAt }, index) => (
            <GameCard
              key={game.id}
              game={game}
              priority={index === 0}
              articleUpdatedAt={articleUpdatedAt}
            />
          ))}
        </div>
        {remainingGames.length ? (
          <LazyMoreGames games={remainingGames} />
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Latest articles</h2>
          <a href="/articles" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">
            View all articles →
          </a>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </section>
  );
}
