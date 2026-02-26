import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { listPublishedArticlesPage, type ArticleWithRelations } from "@/lib/db";
import { ARTICLES_DESCRIPTION, SITE_URL, buildAlternates } from "@/lib/seo";
import { ArticleCard } from "@/components/ArticleCard";
import { PagePagination } from "@/components/PagePagination";

export const ARTICLES_PAGE_SIZE = 20;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

export type ArticlesPageData = {
  articles: ArticleWithRelations[];
  total: number;
  totalPages: number;
};

function formatLoadError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof (error as { message?: unknown }).message === "string") {
    const message = (error as { message: string }).message;
    return message.length > 240 ? `${message.slice(0, 240)}...` : message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function reportLoadError(context: string, error: unknown) {
  if (IS_BUILD) return;
  console.error(context, formatLoadError(error));
}

export async function loadArticlesPageData(pageNumber: number): Promise<ArticlesPageData> {
  try {
    const { articles, total } = await listPublishedArticlesPage(pageNumber, ARTICLES_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));
    return { articles, total, totalPages };
  } catch (error) {
    reportLoadError("Failed to load articles page data", error);
    return { articles: [], total: 0, totalPages: 1 };
  }
}

function ArticlesPageView({
  articles,
  totalPages,
  totalArticles,
  currentPage,
  showHero
}: {
  articles: ArticleWithRelations[];
  totalPages: number;
  totalArticles: number;
  currentPage: number;
  showHero: boolean;
}) {
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
      {showHero ? (
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
              {totalArticles} published articles
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Bloxodes Articles</p>
          <h1 className="text-3xl font-semibold text-foreground">Bloxodes articles</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">Articles will appear here after publication.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((article, index) => (
              <div
                key={article.id}
                className="contents"
                data-analytics-event="select_item"
                data-analytics-item-list-name="articles_index"
                data-analytics-item-id={article.slug}
                data-analytics-item-name={article.title}
                data-analytics-position={index + 1}
                data-analytics-content-type="article"
              >
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        )}
      </section>

      <PagePagination basePath="/articles" currentPage={currentPage} totalPages={totalPages} />

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Articles & Guides",
              description: ARTICLES_DESCRIPTION,
              url: `${SITE_URL}/articles`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export function renderArticlesPage(props: Parameters<typeof ArticlesPageView>[0]) {
  return <ArticlesPageView {...props} />;
}

export const articlesMetadata: Metadata = {
  title: "Articles & Guides",
  description: ARTICLES_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/articles`)
};
