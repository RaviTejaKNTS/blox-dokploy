import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { AuthorSocialLinks } from "@/components/AuthorSocialLinks";
import { ArticleCard } from "@/components/ArticleCard";
import { GameCard } from "@/components/GameCard";
import { authorAvatarUrl } from "@/lib/avatar";
import {
  getAuthorBySlug,
  listAuthorSlugs,
  listPublishedArticlesByAuthor,
  listPublishedGamesByAuthorWithActiveCounts
} from "@/lib/db";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  authorJsonLd,
  breadcrumbJsonLd,
  buildAlternates,
} from "@/lib/seo";

// Cache author pages for a month; on-demand revalidation keeps them fresh
export const revalidate = 2592000; // monthly

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await listAuthorSlugs();
  return slugs.map((slug) => ({ slug }));
}

function markdownToPlain(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\[(.+?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) {
    return {};
  }

  const title = `${author.name} Roblox Guides & Articles`;
  const description = markdownToPlain(author.bio_md) || SITE_DESCRIPTION;
  const canonical = `${SITE_URL}/authors/${author.slug}`;
  const avatar = authorAvatarUrl(author, 256);

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    authors: [{ name: author.name, url: canonical }],
    openGraph: {
      type: "profile",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [avatar || `${SITE_URL}/og-image.png`]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [avatar || `${SITE_URL}/og-image.png`]
    }
  };
}

export default async function AuthorPage({ params }: Params) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) {
    return notFound();
  }

  const [games, articles] = await Promise.all([
    listPublishedGamesByAuthorWithActiveCounts(author.id, author.slug),
    listPublishedArticlesByAuthor(author.id, 12, 0, author.slug)
  ]);
  const avatar = authorAvatarUrl(author, 120);
  const bioHtml = author.bio_md ? await marked.parse(author.bio_md) : "";
  const bioText = markdownToPlain(author.bio_md) || `${author.name} shares the latest Roblox guides and articles on ${SITE_NAME}.`;
  const canonical = `${SITE_URL}/authors/${author.slug}`;
  const breadcrumbData = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Authors", url: `${SITE_URL}/authors` },
      { name: author.name, url: canonical }
    ])
  );
  const authorData = JSON.stringify(
    authorJsonLd({
      siteUrl: SITE_URL,
      author,
      avatar,
      description: bioText
    })
  );

  const authoredGames = games.map((game) => ({
    game,
    articleUpdatedAt: game.content_updated_at ?? game.updated_at ?? null
  }));

  return (
    <div className="space-y-12">
      <header className="rounded-[var(--radius-lg)] border border-border/60 bg-surface px-6 py-8 shadow-soft">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          <img
            src={avatar || "https://www.gravatar.com/avatar/?d=mp"}
            alt={author.name}
            className="h-24 w-24 flex-shrink-0 rounded-full border border-border/50 object-cover shadow-soft"
            loading="lazy"
          />
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">{author.name}</h1>
              {author.slug ? (
                <p className="text-sm text-muted">@{author.slug}</p>
              ) : null}
            </div>
            {bioHtml ? (
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bioHtml }}
              />
            ) : (
              <p className="text-sm text-muted">{bioText}</p>
            )}
            <AuthorSocialLinks author={author} />
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Guides & Updates</h2>
          <p className="text-sm text-muted">
            Active Roblox code collections published by {author.name}.
          </p>
        </div>
        {authoredGames.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {authoredGames.map(({ game, articleUpdatedAt }) => (
              <GameCard key={game.id} game={game} articleUpdatedAt={articleUpdatedAt} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {author.name} hasn't published any guides yet. Check back soon!
          </p>
        )}
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Articles & Deep Dives</h2>
          <p className="text-sm text-muted">
            Long-form Roblox guides and commentary written by {author.name}.
          </p>
        </div>
        {articles.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {author.name} hasn't published any articles yet. Check back soon!
          </p>
        )}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbData }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: authorData }} />
    </div>
  );
}
