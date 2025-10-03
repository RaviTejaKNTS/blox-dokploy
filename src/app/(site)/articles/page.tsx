import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { listArticleCategories, listPublishedArticles } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `Articles | ${SITE_NAME}`,
  description: `${SITE_NAME} articles with Roblox tips, guides, and code breakdowns.`
};

export default async function ArticlesIndexPage() {
  const [articles, categories] = await Promise.all([
    listPublishedArticles(40),
    listArticleCategories()
  ]);

  return (
    <div className="space-y-10">
      <header className="rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">Articles & Guides</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Long-form coverage from the Bloxodes team—deep dives, recommendations, and redemption guides to help you make the most of each
          Roblox experience.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/articles/category/${category.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-1 text-sm text-foreground transition hover:border-accent hover:text-accent"
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">Articles will appear here after publication.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articles.map((article) => {
              const categoryName = article.category?.name;
              const published = new Date(article.published_at);
              const publishedLabel = published.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <article
                  key={article.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/70 shadow-soft transition hover:border-accent"
                >
                  {article.cover_image ? (
                    <div className="relative h-48 w-full overflow-hidden border-b border-border/60">
                      <Image
                        src={article.cover_image}
                        alt={article.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.02]"
                        sizes="(min-width: 768px) 50vw, 100vw"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col gap-4 p-6">
                    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
                      {categoryName ? <span>{categoryName}</span> : null}
                      <span>{publishedLabel}</span>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">
                      <Link href={`/${article.slug}`} className="hover:text-accent">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="line-clamp-3 text-sm text-muted">
                      {article.excerpt ?? article.meta_description ?? SITE_DESCRIPTION}
                    </p>
                    <div className="mt-auto flex items-center justify-between text-xs text-muted">
                      <span>{article.reading_time_minutes ? `${article.reading_time_minutes} min read` : `${article.word_count ?? 0} words`}</span>
                      <Link href={`/${article.slug}`} className="text-accent underline-offset-2 hover:underline">
                        Read article
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
