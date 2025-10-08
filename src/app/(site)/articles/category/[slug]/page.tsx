import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getArticleCategoryBySlug, listPublishedArticlesByCategory } from "@/lib/db";
import { SITE_NAME } from "@/lib/seo";
import { markdownToPlainText } from "@/lib/markdown";

export const revalidate = 300;

type Params = { params: { slug: string } };

type CategoryPageMetadata = Awaited<ReturnType<typeof getArticleCategoryBySlug>>;

function buildMetadata(category: CategoryPageMetadata | null): Metadata {
  if (!category) return {};
  return {
    title: `${category.name} Articles | ${SITE_NAME}`,
    description: category.description ?? undefined
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getArticleCategoryBySlug(params.slug);
  return buildMetadata(category);
}

export default async function ArticleCategoryPage({ params }: Params) {
  const category = await getArticleCategoryBySlug(params.slug);
  if (!category) {
    notFound();
  }

  const articles = await listPublishedArticlesByCategory(params.slug, 40);

  return (
    <div className="space-y-8">
      <header className="space-y-2 rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-muted">
          <Link href="/articles" className="underline-offset-2 hover:underline">
            Articles
          </Link>
          <span>/</span>
          <span>{category.name}</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{category.name}</h1>
        {category.description ? <p className="max-w-2xl text-sm text-muted sm:text-base">{category.description}</p> : null}
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Articles in this category</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">No articles published yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articles.map((article) => {
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
                      <span>{publishedLabel}</span>
                      <span>{Math.max(1, Math.ceil(((article.word_count ?? 0) || 0) / 200))} min read</span>
                    </div>
                    <h3 className="text-2xl font-semibold text-foreground">
                      <Link href={`/${article.slug}`} className="hover:text-accent">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="line-clamp-3 text-sm text-muted">
                      {article.meta_description ?? markdownToPlainText(article.content_md).slice(0, 160)}
                    </p>
                    <div className="mt-auto flex items-center justify-end text-xs text-muted">
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
