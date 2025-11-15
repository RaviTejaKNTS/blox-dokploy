import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { FaTelegramPlane } from "react-icons/fa";
import { RiTwitterXLine } from "react-icons/ri";
import { SiGooglechrome } from "react-icons/si";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { AuthorCard } from "@/components/AuthorCard";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { logger } from "@/lib/logger";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { ExpiredCodes } from "@/components/ExpiredCodes";
import { GameCard } from "@/components/GameCard";
import { SocialShare } from "@/components/SocialShare";
import { CodeBlockEnhancer } from "@/components/CodeBlockEnhancer";
import { EzoicAdSlot } from "@/components/EzoicAdSlot";
import { authorAvatarUrl } from "@/lib/avatar";
import { monthYear } from "@/lib/date";
import {
  getGameBySlug,
  listCodesForGame,
  listGamesWithActiveCounts,
  getArticleBySlug,
  type Author,
  type Code
} from "@/lib/db";
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
import { replaceLinkPlaceholders } from "@/lib/link-placeholders";
import { collectAuthorSocials } from "@/lib/author-socials";
import { extractHowToSteps } from "@/lib/how-to";

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

const NEW_CODE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

function firstSeenTimestamp(code: Pick<Code, "first_seen_at">): number | null {
  if (!code.first_seen_at) return null;
  const time = new Date(code.first_seen_at).getTime();
  return Number.isNaN(time) ? null : time;
}

function sortCodesByFirstSeenDesc<T extends Pick<Code, "first_seen_at">>(codes: T[]): T[] {
  return [...codes].sort((a, b) => {
    const aTime = firstSeenTimestamp(a);
    const bTime = firstSeenTimestamp(b);
    if (aTime === bTime) return 0;
    if (aTime == null) return 1;
    if (bTime == null) return -1;
    return bTime - aTime;
  });
}

function isCodeWithinNewThreshold(code: Pick<Code, "first_seen_at">, referenceMs: number): boolean {
  const firstSeenMs = firstSeenTimestamp(code);
  if (firstSeenMs == null) return false;
  return referenceMs - firstSeenMs <= NEW_CODE_THRESHOLD_MS;
}

interface FaqEntry {
  question: string;
  answer: string;
}

function extractFaqEntries(markdown?: string | null): FaqEntry[] {
  if (!markdown) return [];

  const lines = markdown.split(/\r?\n/);
  const entries: FaqEntry[] = [];
  let currentQuestion: string | null = null;
  let answerLines: string[] = [];

  function pushCurrent() {
    if (!currentQuestion) return;
    const question = markdownToPlainText(currentQuestion).trim();
    const answer = markdownToPlainText(answerLines.join("\n")).trim();
    if (question && answer) {
      entries.push({ question, answer });
    }
    currentQuestion = null;
    answerLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      pushCurrent();
      currentQuestion = headingMatch[1].trim();
      continue;
    }

    if (!currentQuestion) {
      continue;
    }

    if (/^#\s+/.test(line)) {
      pushCurrent();
      continue;
    }

    answerLines.push(rawLine);
  }

  pushCurrent();

  return entries.slice(0, 8);
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

function collectAuthorSameAs(author?: Author | null): string[] {
  if (!author) return [];
  const socials = collectAuthorSocials(author);
  return Array.from(new Set(socials.map((link) => link.url)));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = params.slug;
  const game = await getGameBySlug(slug);

  if (!game || !game.is_published) {
    return {};
  }

  const codes = await listCodesForGame(game.id);
  const latestCodeFirstSeen = codes.reduce<string | null>((latest, code) => {
    if (!code.first_seen_at) return latest;
    if (!latest || code.first_seen_at > latest) return code.first_seen_at;
    return latest;
  }, null);
  const activeCount = codes.filter((code) => code.status === "active").length;
  const lastContentUpdate = latestCodeFirstSeen && latestCodeFirstSeen > game.updated_at
    ? latestCodeFirstSeen
    : game.updated_at;
  const when = monthYear();
  const title = game.seo_title || `${game.name} Codes (${when}) - ${activeCount} Active Codes`;
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
  const otherMeta: Record<string, string> = {};
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
    const article = await getArticleBySlug(params.slug);
    if (article) {
      redirect(`/articles/${article.slug}`);
    }
    notFound();
  }
  
  if (result.error === 'FETCH_ERROR') {
    // Consider redirecting to an error page or showing a custom error component
    throw new Error('Failed to load game data. Please try again later.');
  }
  
  const { game, codes, allGames } = result;
  const author = game.author;
  const authorAvatar = author ? authorAvatarUrl(author, 72) : null;
  const active = codes.filter(c => c.status === "active");
  const needsCheck = codes.filter(c => c.status === "check");
  const nowMs = Date.now();
  const sortedActive = sortCodesByFirstSeenDesc(active);
  const sortedNeedsCheck = sortCodesByFirstSeenDesc(needsCheck);
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
    .slice(0, 6)
    .map((g) => ({
      game: g,
      articleUpdatedAt: g.content_updated_at ?? g.updated_at ?? null
    }));

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

  const linkMap = {
    roblox_link: normalizeUrl(game.roblox_link) ?? normalizeUrl(game.source_url),
    community_link: normalizeUrl(game.community_link),
    discord_link: normalizeUrl(game.discord_link),
    twitter_link: normalizeUrl(game.twitter_link),
    youtube_link: normalizeUrl(game.youtube_link),
  } as const;

  const introMarkdown = game.intro_md ? replaceLinkPlaceholders(game.intro_md, linkMap) : "";
  const redeemMarkdown = game.redeem_md ? replaceLinkPlaceholders(game.redeem_md, linkMap) : "";
  const descriptionMarkdown = game.description_md ? replaceLinkPlaceholders(game.description_md, linkMap) : "";
  const linktextMarkdown = game.linktext_md ? replaceLinkPlaceholders(game.linktext_md, linkMap) : "";

  const redeemSteps = extractHowToSteps(redeemMarkdown || game.redeem_md);
  const faqEntries = extractFaqEntries(descriptionMarkdown);

  const [introHtml, redeemHtml, descriptionHtml, authorBioHtml, linktextHtml] = await Promise.all([
    introMarkdown ? renderMarkdown(introMarkdown) : "",
    redeemMarkdown ? renderMarkdown(redeemMarkdown) : "",
    descriptionMarkdown ? renderMarkdown(descriptionMarkdown) : "",
    author?.bio_md ? renderMarkdown(author.bio_md) : "",
    linktextMarkdown ? renderMarkdown(linktextMarkdown) : "",
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
  const authorSameAs = collectAuthorSameAs(author);
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
  const siteBaseUrl = SITE_URL.replace(/\/$/, "");
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: game.name ?? "Roblox", url: canonicalUrl },
    { name: "Codes", url: `${canonicalUrl}#codes` }
  ];
  const breadcrumbData = JSON.stringify(breadcrumbJsonLd(breadcrumbs));
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: game.name ?? "Roblox", href: null },
    { label: "Codes", href: `${canonicalUrl}#active-codes` }
  ];
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
          subject: { name: game.name, slug: game.slug },
          steps: redeemSteps
        })
      )
    : null;
  const codesFaqEntries = extractFaqEntries(descriptionMarkdown);
  const codesFaqData = codesFaqEntries.length
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: codesFaqEntries.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.answer
          }
        }))
      })
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article itemScope itemType="https://schema.org/Article" className="min-w-0">
        <meta itemProp="mainEntityOfPage" content={canonicalUrl} />
        <meta itemProp="datePublished" content={publishedIso} />
        <meta itemProp="dateModified" content={updatedIso} />
        <meta itemProp="description" content={metaDescription} />
        <meta itemProp="image" content={coverImage} />
        {!author ? <meta itemProp="author" content={SITE_NAME} /> : null}
        <nav aria-label="Breadcrumb" className="mb-4 text-xs uppercase tracking-[0.25em] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbNavItems.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                {item.href ? (
                  <Link href={item.href} className="font-semibold text-muted transition hover:text-accent">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground/80">{item.label}</span>
                )}
                {index < breadcrumbNavItems.length - 1 ? <span className="text-muted/60">&gt;</span> : null}
              </li>
            ))}
          </ol>
        </nav>
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
                    loading="lazy"
                    decoding="async"
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
                Last checked for new codes on{' '}
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
            {active.length > 0 ? (
              <p className="text-muted">
                Right now, there are {active.length} active {active.length === 1 ? "code" : "codes"} you can use.
              </p>
            ) : null}
          </div>
          {active.length === 0 ? (
            <p className="text-muted">
              We haven't confirmed any working codes right now{needsCheck.length ? ", but try the unverified ones below." : ". Check back soon."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {sortedActive.map(c => {
                const rewards = cleanRewardsText(c.rewards_text);
                const isNew = isCodeWithinNewThreshold(c, nowMs);
                return (
                  <article
                    key={c.id}
                    className="rounded-[var(--radius-sm)] border border-accent/25 bg-surface px-5 py-4 shadow-soft"
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
                            {isNew ? (
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
              <h2>Likely Expired Codes</h2>
              <p>
                These codes might have just expired and may not work. However, we haven’t verified them ourselves yet. 
                To be sure, try redeeming them in {game.name} yourself.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              {sortedNeedsCheck.map(c => {
                const rewards = cleanRewardsText(c.rewards_text);
                return (
                  <article
                    key={c.id}
                    className="rounded-[var(--radius-sm)] border border-amber-200/70 bg-surface px-5 py-4 shadow-soft"
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

        {linktextHtml ? (
          <section className="mb-8" aria-label="Recommended Roblox games">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(linktextHtml)}
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

        <div className="mb-8">
          {/* Ezoic - incontent_5 - incontent_5 */}
          <EzoicAdSlot placeholderId={115} />
        </div>

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
        {codesFaqData && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: codesFaqData }} />
        )}
        <CodeBlockEnhancer />
      </article>

      {recommended.length > 0 ? (
        <aside className="space-y-4">
          <SocialShare url={canonicalUrl} title={`${game.name} Codes (${monthYear()})`} />
          <section className="panel space-y-3 px-4 py-5">
            <h3 className="text-lg font-semibold text-foreground">Get Roblox codes directly on</h3>
            <div className="space-y-2 text-sm">
              <Link
                href="https://t.me/bloxodes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3 font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <FaTelegramPlane className="h-4 w-4" aria-hidden />
                  Telegram
                </span>
                <span className="text-xs text-muted">@bloxodes</span>
              </Link>
              <Link
                href="https://x.com/bloxodes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3 font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <RiTwitterXLine className="h-4 w-4" aria-hidden />
                  X (Twitter)
                </span>
                <span className="text-xs text-muted">@bloxodes</span>
              </Link>
              <Link
                href="https://chromewebstore.google.com/detail/bloxodes-%E2%80%93-roblox-game-co/mammkedlehmpechknaicfakljaogcmhc?authuser=0&hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3 font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <SiGooglechrome className="h-4 w-4" aria-hidden />
                  Chrome Extension
                </span>
                <span className="text-xs text-muted">Add to Chrome</span>
              </Link>
            </div>
          </section>
          <div className="space-y-2 p-2">
            <h3 className="text-lg font-semibold text-foreground">More games with codes</h3>
            <p className="text-sm text-muted">Discover other Roblox games that currently have active rewards.</p>
          </div>
          <div className="grid gap-4">
            {recommended.map(({ game: g, articleUpdatedAt }) => (
              <GameCard key={g.id} game={g} titleAs="p" articleUpdatedAt={articleUpdatedAt} />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
