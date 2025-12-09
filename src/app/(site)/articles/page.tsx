import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { listPublishedArticles } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { ArticleCard } from "@/components/ArticleCard";

export const revalidate = 604800; // weekly

export const metadata: Metadata = {
  title: "Articles & Guides",
  description: `${SITE_NAME} articles with Roblox tips, guides, and code breakdowns.`
};

export default async function ArticlesIndexPage() {
  const articles = await listPublishedArticles(40);
  const latest = articles.reduce<Date | null>((latestDate, article) => {
    const candidate = article.updated_at ?? article.published_at ?? article.created_at;
    if (!candidate) return latestDate;
    const candidateDate = new Date(candidate);
    if (!latestDate || candidateDate > latestDate) return candidateDate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Bloxodes Articles</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Fresh Roblox guides, tips, and updates from Bloxodes
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Long-form guides, recommendations, and redemption walkthroughs updated regularly to help you get more from every Roblox game.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {articles.length} published articles
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">Articles will appear here after publication.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
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
            name: "Articles & Guides",
            description: `${SITE_NAME} articles with Roblox tips, guides, and code breakdowns.`,
            url: `${SITE_URL}/articles`
          })
        }}
      />
    </div>
  );
}
