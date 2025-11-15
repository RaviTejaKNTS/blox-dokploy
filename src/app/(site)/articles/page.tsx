import type { Metadata } from "next";
import { listPublishedArticles } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";
import { ArticleCard } from "@/components/ArticleCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Articles & Guides",
  description: `${SITE_NAME} articles with Roblox tips, guides, and code breakdowns.`
};

export default async function ArticlesIndexPage() {
  const articles = await listPublishedArticles(40);

  return (
    <div className="space-y-10">
      <header className="rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">Articles & Guides</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Long-form coverage from the Bloxodes team—deep dives, recommendations, and redemption guides to help you make the most of each
          Roblox experience.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">Articles will appear here after publication.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
