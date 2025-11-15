import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import type { IconType } from "react-icons";
import { FaFacebook, FaTelegramPlane, FaTwitch, FaUsers, FaYoutube, FaDiscord } from "react-icons/fa";
import { RiTwitterXLine } from "react-icons/ri";
import { SiGooglechrome, SiGuilded, SiRoblox } from "react-icons/si";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { logger } from "@/lib/logger";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { ExpiredCodes } from "@/components/ExpiredCodes";
import { GameCard } from "@/components/GameCard";
import { SocialShare } from "@/components/SocialShare";
import { CodeBlockEnhancer } from "@/components/CodeBlockEnhancer";
import { EzoicAdSlot } from "@/components/EzoicAdSlot";
import { monthYear } from "@/lib/date";
import {
  getGameBySlug,
  listCodesForGame,
  listGamesWithActiveCounts,
  getArticleBySlug,
  getRobloxUniverseById,
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

type UniverseSocialLink = {
  platform: string;
  url: string;
  title?: string | null;
};

const UNIVERSE_SOCIAL_META: Record<string, { label: string; icon: IconType }> = {
  twitter: { label: "Twitter / X", icon: RiTwitterXLine },
  youtube: { label: "YouTube", icon: FaYoutube },
  discord: { label: "Discord", icon: FaDiscord },
  twitch: { label: "Twitch", icon: FaTwitch },
  facebook: { label: "Facebook", icon: FaFacebook },
  roblox_group: { label: "Roblox Group", icon: SiRoblox },
  guilded: { label: "Guilded", icon: SiGuilded }
};

const DEFAULT_SOCIAL_META: { label: string; icon: IconType } = {
  label: "Website",
  icon: SiGooglechrome
};

function extractUniverseSocialLinks(raw: unknown): UniverseSocialLink[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const entries: UniverseSocialLink[] = [];
  for (const [platform, value] of Object.entries(record)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const url = typeof (entry as Record<string, unknown>).url === "string" ? (entry as Record<string, unknown>).url.trim() : "";
      if (!url) continue;
      const title = typeof (entry as Record<string, unknown>).title === "string" ? (entry as Record<string, unknown>).title : null;
      entries.push({
        platform,
        url,
        title
      });
    }
  }
  return entries;
}

function extractHandleFromUrl(platform: string, url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    let handle = segments.length ? segments[segments.length - 1] : parsed.hostname;
    if (!handle) return null;
    if (handle.includes("?")) {
      handle = handle.split("?")[0];
    }
    handle = handle.replace(/\/+$/, "");
    if (!handle) return null;
    if (platform === "twitter") {
      handle = handle.replace(/^@/, "");
      return handle ? `@${handle}` : null;
    }
    if (platform === "youtube" && handle.startsWith("@")) {
      return handle;
    }
    return handle;
  } catch {
    return null;
  }
}

function formatSocialLabel(platform: string, link: UniverseSocialLink, creatorName?: string | null): string {
  if (platform === "roblox_group") {
    return creatorName ? `${creatorName} Roblox Community` : "Roblox Community";
  }
  if (platform === "discord") {
    return "Discord";
  }
  const handle = extractHandleFromUrl(platform, link.url);
  if (handle) return handle;
  return link.title?.trim() || UNIVERSE_SOCIAL_META[platform]?.label || DEFAULT_SOCIAL_META.label;
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
    authors: [{ name: SITE_NAME, url: SITE_URL }],
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
      authors: [SITE_NAME]
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

    const [codes, allGames, universe] = await Promise.all([
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
      }),
      game.universe_id
        ? getRobloxUniverseById(game.universe_id).catch(error => {
            logger.error("Failed to fetch roblox universe", {
              universeId: game.universe_id,
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          })
        : Promise.resolve(null)
    ]);

    return { game, codes, allGames, universe };
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
  
  const { game, codes, allGames, universe } = result;
  const active = codes.filter(c => c.status === "active");
  const nowMs = Date.now();
  const sortedActive = sortCodesByFirstSeenDesc(active);
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

  const universeDeveloperName = universe?.creator_name ? universe.creator_name.trim() : null;
  const universeSocialLinks = extractUniverseSocialLinks(universe?.social_links ?? null);

  const linkMap = {
    roblox_link: normalizeUrl(game.roblox_link) ?? normalizeUrl(game.source_url),
    community_link: normalizeUrl(game.community_link),
    discord_link: normalizeUrl(game.discord_link),
    twitter_link: normalizeUrl(game.twitter_link),
    youtube_link: normalizeUrl(game.youtube_link),
  } as const;

  const introMarkdown = game.intro_md ? replaceLinkPlaceholders(game.intro_md, linkMap) : "";
  const redeemMarkdown = game.redeem_md ? replaceLinkPlaceholders(game.redeem_md, linkMap) : "";
  const linktextMarkdown = game.linktext_md ? replaceLinkPlaceholders(game.linktext_md, linkMap) : "";

  const redeemSteps = extractHowToSteps(redeemMarkdown || game.redeem_md);

  const [introHtml, redeemHtml, linktextHtml] = await Promise.all([
    introMarkdown ? renderMarkdown(introMarkdown) : "",
    redeemMarkdown ? renderMarkdown(redeemMarkdown) : "",
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
      author: null,
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
  const codesFaqData = null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="min-w-0">
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
              <span className="text-foreground">
                Maintained by <span className="font-semibold text-foreground">Bloxodes Team</span>
              </span>
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
            <p className="text-muted">We haven't confirmed any working codes right now. Check back soon.</p>
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

        {universe ? (
          <section className="mb-8 space-y-4" id={`more-${game.slug}-codes`}>
            <div className="prose dark:prose-invert max-w-none game-copy">
              <h2>How to Get New Codes Fast</h2>
              <p>New codes are posted here by the developers:</p>
            </div>
            {universeSocialLinks.length ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {universeSocialLinks.map((link) => {
                  const url = normalizeUrl(link.url);
                  if (!url) return null;
                  const meta = UNIVERSE_SOCIAL_META[link.platform] ?? DEFAULT_SOCIAL_META;
                  const Icon = meta.icon;
                  return (
                    <a
                      key={`${link.platform}-${url}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span>{formatSocialLabel(link.platform, link, universeDeveloperName)}</span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">We haven&apos;t found any official social media links yet.</p>
            )}

            <div className="prose dark:prose-invert max-w-none game-copy">
              <p>
                We keep track of these sources and update this page as soon as new codes drop. Bookmark this page or follow our channels to get the codes right away.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://t.me/bloxodes"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              >
                <FaTelegramPlane className="h-4 w-4" aria-hidden />
                <span>@bloxodes</span>
              </a>
              <a
                href="https://twitter.com/bloxodes"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              >
                <RiTwitterXLine className="h-4 w-4" aria-hidden />
                <span>@bloxodes</span>
              </a>
              <a
                href="https://chromewebstore.google.com/detail/bloxodes-%E2%80%93-roblox-game-co/mammkedlehmpechknaicfakljaogcmhc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              >
                <SiGooglechrome className="h-4 w-4" aria-hidden />
                <span>Install Chrome Extension</span>
              </a>
            </div>
          </section>
        ) : null}

        <div className="mb-8">
          {/* Ezoic - incontent_5 - incontent_5 */}
          <EzoicAdSlot placeholderId={115} />
        </div>

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
