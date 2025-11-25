import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { AuthorSocialLinks } from "@/components/AuthorSocialLinks";
import { GameCard } from "@/components/GameCard";
import { authorAvatarUrl } from "@/lib/avatar";
import {
  getAuthorBySlug,
  listPublishedGamesByAuthorWithActiveCounts
} from "@/lib/db";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  authorJsonLd,
  breadcrumbJsonLd
} from "@/lib/seo";

// Cache author pages for 10 minutes to avoid per-request SSR
export const revalidate = 600;

type Params = { params: { slug: string } };

function markdownToPlain(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\[(.+?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const author = await getAuthorBySlug(params.slug);
  if (!author) {
    return {};
  }

  const title = `${author.name} Roblox Code Guides`;
  const description = markdownToPlain(author.bio_md) || SITE_DESCRIPTION;
  const canonical = `${SITE_URL}/authors/${author.slug}`;
  const avatar = authorAvatarUrl(author, 256);

  return {
    title,
    description,
    alternates: { canonical },
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
  const author = await getAuthorBySlug(params.slug);
  if (!author) {
    return notFound();
  }

  const games = await listPublishedGamesByAuthorWithActiveCounts(author.id);
  const avatar = authorAvatarUrl(author, 120);
  const bioHtml = author.bio_md ? await marked.parse(author.bio_md) : "";
  const bioText = markdownToPlain(author.bio_md) || `${author.name} shares the latest Roblox code guides on ${SITE_NAME}.`;
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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbData }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: authorData }} />
    </div>
  );
}
