import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AuthorCard } from "@/components/AuthorCard";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { logger } from "@/lib/logger";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { ExpiredCodes } from "@/components/ExpiredCodes";
import { GameCard } from "@/components/GameCard";
import { SocialShare } from "@/components/SocialShare";
import { authorAvatarUrl } from "@/lib/avatar";
import { monthYear } from "@/lib/date";
import { getGameBySlug, listCodesForGame, listGamesWithActiveCounts } from "@/lib/db";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  breadcrumbJsonLd,
  codesItemListJsonLd,
  gameJsonLd,
  webPageJsonLd,
  howToJsonLd
} from "@/lib/seo";

export const revalidate = 30;

type Params = { params: { slug: string } };

function cleanRewardsText(text?: string | null): string | null {
  if (!text) return null;
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^New Code/i, "").trim();
  t = t.replace(/^Copy/i, "").trim();
  t = t.replace(/\s*(Active|Expired|Check)\s*$/i, "").trim();
  t = t.replace(/this code credits your account with/i, "This code gives you");
  return t || null;
}

interface HowToStep {
  text: string;
  image?: string;
}

function extractHowToSteps(markdown?: string | null): string[] {
  if (!markdown) return [];
  
  const lines = markdown.split(/\r?\n/);
  const steps: string[] = [];
  let currentStep: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check for H2 heading (## )
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      // If we have a current step, add it before starting a new section
      if (currentStep) {
        steps.push(currentStep);
        currentStep = null;
      }
      continue;
    }
    
    // Check for numbered list items (1., 2., etc.)
    const stepMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (stepMatch) {
      // If we have a current step, add it before starting a new one
      if (currentStep) {
        steps.push(currentStep);
      }
      currentStep = stepMatch[2];
      continue;
    }
    
    // Check for images in the current line
    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      // If we have an image and a current step, we can associate it
      // For now, we'll just add it to the current step text
      // In a more advanced implementation, we could return an array of objects with text and image
      if (currentStep) {
        currentStep += ` [Image: ${imageMatch[1] || 'Step illustration'}]`;
      }
      continue;
    }
    
    // If we have a current step and this is a continuation line, append it
    if (currentStep && line.match(/^[^#\d\-*+]/)) {
      currentStep += ' ' + line.replace(/^\s*[-*+]\s*/, '').trim();
    }
  }
  
  // Add the last step if there is one
  if (currentStep) {
    steps.push(currentStep);
  }
  
  return steps.slice(0, 10); // Limit to 10 steps
}

function normalizeTwitter(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  if (!handle) return null;
  return `https://twitter.com/${handle}`;
}

/**
 * Validates if a string is a valid HTTP/HTTPS URL
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes and validates a URL string
 * - Trims whitespace
 * - Adds https:// if no protocol is present
 * - Validates the resulting URL
 * - Returns null for invalid URLs
 */
function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  
  // Trim and check for empty string
  let trimmed = value.trim();
  if (!trimmed) return null;

  // Add https:// if no protocol is present
  if (!/^https?:\/\//i.test(trimmed)) {
    // Remove any leading slashes that might cause issues
    trimmed = `https://${trimmed.replace(/^[\s/]+/, '')}`;
  }

  // Validate the URL before returning
  return isValidUrl(trimmed) ? trimmed : null;
}

function collectAuthorSameAs(author?: { twitter?: string | null; youtube?: string | null; website?: string | null } | null): string[] {
  if (!author) return [];
  const links: string[] = [];
  const twitter = normalizeTwitter(author.twitter);
  if (twitter) links.push(twitter);
  if (author.youtube) {
    const yt = normalizeUrl(author.youtube);
    if (yt) links.push(yt);
  }
  if (author.website) {
    const site = normalizeUrl(author.website);
    if (site) links.push(site);
  }
  return Array.from(new Set(links));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const game = await getGameBySlug(params.slug);
  if (!game) return {};
  const codes = await listCodesForGame(game.id);
  const latestCodeFirstSeen = codes.reduce<string | null>((latest, code) => {
    if (!code.first_seen_at) return latest;
    if (!latest || code.first_seen_at > latest) return code.first_seen_at;
    return latest;
  }, null);
  const lastContentUpdate = latestCodeFirstSeen && latestCodeFirstSeen > game.updated_at
    ? latestCodeFirstSeen
    : game.updated_at;
  const when = monthYear();
  const title = game.seo_title || `${game.name} Codes (${when})`;
  const descriptionRaw =
    game.seo_description ||
    `Get the latest ${game.name} codes for ${when} and redeem them for free in-game rewards. Updated daily with only active and working codes.`;
  const description = descriptionRaw?.trim() || SITE_DESCRIPTION;
  const canonicalUrl = `${SITE_URL}/${game.slug}`;
  const coverImage = game.cover_image?.startsWith("http")
    ? game.cover_image
    : game.cover_image
    ? `${SITE_URL.replace(/\/$/, "")}/${game.cover_image.replace(/^\//, "")}`
    : `${SITE_URL}/og-image.png`;
  const publishedTime = new Date(game.created_at).toISOString();
  const modifiedTime = new Date(lastContentUpdate).toISOString();
  const authorUrl = game.author?.slug
    ? `${SITE_URL.replace(/\/$/, "")}/authors/${game.author.slug}`
    : undefined;
  const authors = game.author ? [{ name: game.author.name, url: authorUrl }] : undefined;
  const authorBioPlain = game.author?.bio_md ? markdownToPlainText(game.author.bio_md) : null;
  const authorSameAs = collectAuthorSameAs(game.author);
  const otherMeta: Record<string, string> = {};
  if (authorBioPlain) {
    otherMeta["author:bio"] = authorBioPlain;
  }
  authorSameAs.forEach((url, idx) => {
    otherMeta[`author:social:${idx + 1}`] = url;
  });
  return {
    title,
    description,
    keywords: [
      `${game.name} codes`,
      "Roblox codes",
      "Roblox promo codes",
      "gaming rewards",
      "Bloxodes"
    ],
    category: "Gaming",
    alternates: { canonical: canonicalUrl },
    authors,
    publisher: SITE_NAME,
    openGraph: {
      type: "article",
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [coverImage],
      publishedTime,
      modifiedTime,
      locale: "en_US",
      authors: authors?.map((author) => author.name) ?? [SITE_NAME]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@bloxodes",
      site: "@bloxodes",
      images: [coverImage]
    },
    ...(Object.keys(otherMeta).length ? { other: otherMeta } : {})
  };
}

async function fetchGameData(slug: string) {
  try {
    const game = await getGameBySlug(slug);
    if (!game || !game.is_published) return { error: 'NOT_FOUND' as const };

    const [codes, allGames] = await Promise.all([
      listCodesForGame(game.id).catch(error => {
        logger.error('Failed to fetch codes for game', { 
          gameId: game.id,
          error: error instanceof Error ? error.message : String(error)
        });
        return [];
      }),
      listGamesWithActiveCounts().catch(error => {
        logger.error('Failed to fetch game list', {
          error: error instanceof Error ? error.message : String(error)
        });
        return [];
      })
    ]);

    return { game, codes, allGames };
  } catch (error) {
    logger.error('Failed to fetch game data', {
      slug,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return { error: 'FETCH_ERROR' as const };
  }
}

export default async function GamePage({ params }: Params) {
  const result = await fetchGameData(params.slug);
  
  if (result.error === 'NOT_FOUND') {
    notFound();
  }
  
  if (result.error === 'FETCH_ERROR') {
    // Consider redirecting to an error page or showing a custom error component
    throw new Error('Failed to load game data. Please try again later.');
  }
  
  const { game, codes, allGames } = result;
  const author = game.author;
  const authorAvatar = author ? authorAvatarUrl(author, 72) : null;
  const redeemSteps = extractHowToSteps(game.redeem_md);

  const active = codes.filter(c => c.status === "active");
  const needsCheck = codes.filter(c => c.status === "check");
  const expired = Array.isArray(game.expired_codes) ? game.expired_codes : [];
  const latestCodeFirstSeen = codes.reduce<string | null>((latest, code) => {
    if (!code.first_seen_at) return latest;
    if (!latest || code.first_seen_at > latest) return code.first_seen_at;
    return latest;
  }, null);

  const lastContentUpdate = latestCodeFirstSeen && latestCodeFirstSeen > game.updated_at
    ? latestCodeFirstSeen
    : game.updated_at;

  const lastUpdatedFormatted = new Date(lastContentUpdate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const lastChecked = codes.reduce((acc, c) => (acc > c.last_seen_at ? acc : c.last_seen_at), game.updated_at);
  const recommended = allGames
    .filter((g) => g.id !== game.id)
    .sort((a, b) => {
      if (b.active_count !== a.active_count) return b.active_count - a.active_count;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);

  const lastCheckedDate = new Date(lastChecked);
  const lastCheckedDatePart = lastCheckedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const lastCheckedFormatted = lastCheckedDatePart;

  const lastCheckedRelativeLabel = (() => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const checkedUtc = Date.UTC(
      lastCheckedDate.getUTCFullYear(),
      lastCheckedDate.getUTCMonth(),
      lastCheckedDate.getUTCDate()
    );
    const diffDays = Math.round((todayUtc - checkedUtc) / (24 * 60 * 60 * 1000));
    switch (diffDays) {
      case 0:
        return "Today";
      case 1:
        return "Yesterday";
      case 2:
        return "2 days ago";
      case 3:
        return "3 days ago";
      default:
        return null;
    }
  })();

  const [introHtml, redeemHtml, descriptionHtml, authorBioHtml] = await Promise.all([
    game.intro_md ? renderMarkdown(game.intro_md) : "",
    game.redeem_md ? renderMarkdown(game.redeem_md) : "",
    game.description_md ? renderMarkdown(game.description_md) : "",
    author?.bio_md ? renderMarkdown(author.bio_md) : "",
  ]);

  const canonicalUrl = `${SITE_URL}/${game.slug}`;
  const coverImage = game.cover_image?.startsWith("http")
    ? game.cover_image
    : game.cover_image
    ? `${SITE_URL.replace(/\/$/, "")}/${game.cover_image.replace(/^\//, "")}`
    : `${SITE_URL}/og-image.png`;
  const metaDescriptionRaw = markdownToPlainText(
    game.seo_description ||
      `Get the latest ${game.name} codes for ${monthYear()} and redeem them for free in-game rewards. Updated daily with only active and working codes.`
  );
  const metaDescription = metaDescriptionRaw?.trim() || SITE_DESCRIPTION;
  const publishedIso = new Date(game.created_at).toISOString();
  const updatedIso = new Date(lastContentUpdate).toISOString();
  const lastCheckedIso = new Date(lastChecked).toISOString();
  const authorBioPlain = author?.bio_md ? markdownToPlainText(author.bio_md) : null;
  const authorSameAs = collectAuthorSameAs(author || undefined);
  const authorProfileUrl = author?.slug
    ? `${SITE_URL.replace(/\/$/, "")}/authors/${author.slug}`
    : undefined;
  const structuredAuthor = author
    ? {
        name: author.name,
        url: authorProfileUrl || null,
        description: authorBioPlain,
        sameAs: authorSameAs.length ? authorSameAs : null
      }
    : null;
  const breadcrumbData = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: `${game.name} Codes`, url: canonicalUrl }
    ])
  );
  const videoGameData = JSON.stringify(
    gameJsonLd({ siteUrl: SITE_URL, game: { name: game.name, slug: game.slug, image: coverImage } })
  );
  const codesItemListData = JSON.stringify(
    codesItemListJsonLd({
      siteUrl: SITE_URL,
      game: { name: game.name, slug: game.slug },
      codes: codes.map((code) => ({
        code: code.code,
        status: code.status,
        reward: cleanRewardsText(code.rewards_text)
      }))
    })
  );
  const webPageData = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: game.slug,
      title: `${game.name} Codes (${monthYear()})`,
      description: metaDescription,
      image: coverImage,
      author: structuredAuthor,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const howToData = redeemSteps.length
    ? JSON.stringify(
        howToJsonLd({
          siteUrl: SITE_URL,
          game: { name: game.name, slug: game.slug },
          steps: redeemSteps
        })
      )
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article itemScope itemType="https://schema.org/Article">
        <meta itemProp="mainEntityOfPage" content={canonicalUrl} />
        <meta itemProp="datePublished" content={publishedIso} />
        <meta itemProp="dateModified" content={updatedIso} />
        <meta itemProp="description" content={metaDescription} />
        <meta itemProp="image" content={coverImage} />
        {!author ? <meta itemProp="author" content={SITE_NAME} /> : null}
        <header className="mb-6">
          <h1 className="text-5xl font-bold text-foreground" itemProp="headline">
            {game.name} Codes ({monthYear()})
          </h1>
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted">
            <div className="flex flex-wrap items-center gap-2">
              {author ? (
                <div className="flex items-center gap-2" itemProp="author" itemScope itemType="https://schema.org/Person">
                  {authorProfileUrl ? <link itemProp="url" href={authorProfileUrl} /> : null}
                  {authorBioPlain ? <meta itemProp="description" content={authorBioPlain} /> : null}
                  {authorSameAs.map((url) => (
                    <link key={url} itemProp="sameAs" href={url} />
                  ))}
                  <img
                    src={authorAvatar || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={author.name}
                    className="h-9 w-9 rounded-full border border-border/40 object-cover"
                  />
                  <span>
                    Authored by {author.slug ? (
                      <Link
                        href={`/authors/${author.slug}`}
                        className="font-semibold text-foreground transition hover:text-accent"
                        itemProp="name"
                      >
                        {author.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground" itemProp="name">{author.name}</span>
                    )}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-foreground" itemProp="author">
                  Published by {SITE_NAME}
                </span>
              )}
              <span aria-hidden="true">•</span>
              <span className="text-foreground/80">
                Updated on <span className="font-semibold text-foreground">{lastUpdatedFormatted}</span>
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-accent/40 bg-accent/10 px-4 py-4 font-medium text-accent">
              <time dateTime={lastCheckedIso}>
                Last checked for new {game.name} codes on{' '}
                <span className="font-semibold text-foreground">{lastCheckedFormatted}</span>
                {lastCheckedRelativeLabel ? <span>{' '}({lastCheckedRelativeLabel})</span> : null}
              </time>
            </div>
          </div>
        </header>

        {introHtml ? (
          <section className="mb-8" id="intro" itemProp="articleBody">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(introHtml)}
            />
          </section>
        ) : null}

        <section className="panel mb-8 space-y-3 px-5 pb-5 pt-0" id="active-codes">
          <div className="prose prose-headings:mt-0 prose-headings:mb-2 prose-p:mt-2 dark:prose-invert max-w-none">
            <h2>Active {game.name} Codes</h2>
            <p className="text-muted">
              Right now, there are {active.length} active {active.length === 1 ? "code" : "codes"} you can use in {game.name}. Remember, these codes are case-sensitive, so copy/paste or enter them exactly as shown.
            </p>
          </div>
          {active.length === 0 ? (
            <p className="text-muted">
              We haven't confirmed any working codes right now{needsCheck.length ? ", but try the unverified ones below." : ". Check back soon."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {[...active].reverse().map(c => {
                const rewards = cleanRewardsText(c.rewards_text);
                return (
                  <article
                    key={c.id}
                    className="rounded-[var(--radius-sm)] border border-accent/25 bg-surface px-5 py-4 shadow-soft transition hover:-translate-y-[1px] hover:border-accent/40 hover:shadow-lg"
                  >
                    <div className="flex flex-wrap gap-4 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start md:gap-6">
                      <div className="basis-full flex flex-col gap-3 md:basis-auto">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative inline-flex max-w-full min-w-0 justify-start">
                            <code
                              id={c.code}
                              className="inline-flex max-w-full flex-wrap items-center justify-start gap-2 rounded-full bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-left text-sm font-semibold leading-tight text-white shadow-soft whitespace-normal break-words break-all min-w-0"
                            >
                              <span className="max-w-full break-words break-all leading-snug tracking-[0.08em]">{c.code}</span>
                            </code>
                            {c.is_new ? (
                              <span className="pointer-events-none absolute -top-2 -right-2 inline-flex items-center rounded-full bg-[#0f1121] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_18px_28px_-16px_rgba(72,92,255,0.55)] ring-2 ring-accent/25 rotate-2 md:-top-2 md:-right-2 dark:bg-white dark:text-accent">
                                New
                              </span>
                            ) : null}
                          </div>
                          <CopyCodeButton code={c.code} tone="accent" />
                          {c.level_requirement != null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                              Level {c.level_requirement}+
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="basis-full rounded-[var(--radius-sm)] bg-surface-muted/60 pl-1 pr-4 py-3 text-sm leading-relaxed text-foreground/90 md:basis-auto md:rounded-none md:border-l md:border-border/40 md:bg-transparent md:px-0 md:py-0 md:pl-6">
                        {rewards ? rewards : <span className="text-muted">No reward listed</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {needsCheck.length > 0 ? (
          <section className="panel mb-8 space-y-3 px-5 pb-5 pt-0" id="needs-check">
            <div className="prose prose-headings:mt-0 prose-headings:mb-2 prose-p:mt-2 dark:prose-invert max-w-none">
              <h2>Codes To Double-Check</h2>
            </div>
            <div className="flex flex-col gap-4">
              {[...needsCheck].reverse().map(c => {
                const rewards = cleanRewardsText(c.rewards_text);
                return (
                  <article
                    key={c.id}
                    className="rounded-[var(--radius-sm)] border border-amber-200/70 bg-surface px-5 py-4 shadow-soft transition hover:-translate-y-[1px] hover:border-amber-300 dark:border-amber-500/40"
                  >
                    <div className="flex flex-wrap gap-4 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start md:gap-6">
                      <div className="basis-full flex flex-col gap-3 md:basis-auto">
                        <div className="flex flex-wrap items-center gap-3">
                          <code className="inline-flex max-w-full flex-wrap items-center justify-start gap-2 rounded-full bg-surface-muted px-4 py-2 text-left text-sm font-semibold leading-tight text-foreground shadow-soft whitespace-normal break-words break-all min-w-0">
                            <span className="max-w-full break-words break-all leading-snug tracking-[0.08em]">{c.code}</span>
                          </code>
                          <CopyCodeButton code={c.code} />
                          {c.level_requirement != null ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-400/70 dark:bg-amber-500/10 dark:text-amber-100">
                              Level {c.level_requirement}+
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="basis-full rounded-[var(--radius-sm)] bg-surface-muted/60 pl-0 pr-4 py-3 text-sm leading-relaxed text-foreground/90 md:basis-auto md:rounded-none md:border-l md:border-border/40 md:bg-transparent md:px-0 md:py-0 md:pl-6">
                        {rewards ? rewards : <span className="text-muted">No reward listed</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {redeemHtml ? (
          <section className="mb-8" id="redeem" itemProp="articleBody">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(redeemHtml)}
            />
          </section>
        ) : null}

        <section className="panel mb-8 space-y-3 px-5 pb-5 pt-0" id="expired-codes">
          <div className="prose prose-headings:mt-0 prose-headings:mb-2 prose-p:mt-2 dark:prose-invert max-w-none">
            <h2>Expired {game.name} Codes</h2>
            {expired.length === 0 ? (
              <p className="text-muted">We haven't tracked any expired codes yet.</p>
            ) : null}
          </div>
          {expired.length === 0 ? null : <ExpiredCodes codes={expired} />}
        </section>

        <section className="mb-10" id="description" itemProp="articleBody">
          {descriptionHtml ? (
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(descriptionHtml)}
            />
          ) : (
            <p className="text-muted">This section will explain the game and how to redeem codes.</p>
          )}
        </section>

        {author ? <AuthorCard author={author} bioHtml={processHtmlLinks(authorBioHtml)} /> : null}

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbData }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: videoGameData }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: codesItemListData }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webPageData }} />
        {howToData && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: howToData }} />
        )}
      </article>

      {recommended.length > 0 ? (
        <aside className="space-y-4">
          <SocialShare url={canonicalUrl} title={`${game.name} Codes (${monthYear()})`} />
          <div className="space-y-2 p-2">
            <h3 className="text-lg font-semibold text-foreground">More games with codes</h3>
            <p className="text-sm text-muted">Discover other Roblox games that currently have active rewards.</p>
          </div>
          <div className="grid gap-4">
            {recommended.map((g) => (
              <GameCard key={g.id} game={g} titleAs="p" />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
