import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { IconType } from "react-icons";
import { FaFacebook, FaTelegramPlane, FaTwitch, FaUsers, FaYoutube, FaDiscord } from "react-icons/fa";
import { RiTwitterXLine } from "react-icons/ri";
import { SiGooglechrome, SiGuilded, SiRoblox } from "react-icons/si";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { logger } from "@/lib/logger";
import { ActiveCodes } from "@/components/ActiveCodes";
import { ExpiredCodes } from "@/components/ExpiredCodes";
import { GameCard } from "@/components/GameCard";
import { SocialShare } from "@/components/SocialShare";
import dynamic from "next/dynamic";
import { monthYear } from "@/lib/date";
import { authorAvatarUrl } from "@/lib/avatar";
import { AuthorCard } from "@/components/AuthorCard";
import { collectAuthorSocials } from "@/lib/author-socials";
import { isCodeWithinNewThreshold, sortCodesByFirstSeenDesc } from "@/lib/code-utils";
import {
  getGameBySlug,
  listGamesWithActiveCounts
} from "@/lib/db";
import type { Code, GameWithCounts } from "@/lib/db";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  breadcrumbJsonLd
} from "@/lib/seo";
import { replaceLinkPlaceholders } from "@/lib/link-placeholders";
import { extractHowToSteps } from "@/lib/how-to";

export const revalidate = 86400; // daily

const LazyCodeBlockEnhancer = dynamic(
  () => import("@/components/CodeBlockEnhancer").then((mod) => mod.CodeBlockEnhancer),
  { ssr: false }
);

export type Params = { params: { slug: string } };

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

type SocialLinkButton = { key: string; url: string; label: string; Icon: IconType };

function buildCreatorSocialLink(universe?: {
  creator_id: number | null;
  creator_type: string | null;
  creator_name: string | null;
} | null): SocialLinkButton | null {
  if (!universe) return null;
  const { creator_id: creatorId, creator_type: creatorTypeRaw, creator_name: creatorNameRaw } = universe;
  if (creatorId == null) return null;
  const creatorType = creatorTypeRaw?.toLowerCase();
  const creatorName = creatorNameRaw?.trim();
  if (!creatorType || !creatorName) return null;

  if (creatorType === "user") {
    return {
      key: `creator-user-${creatorId}`,
      url: `https://www.roblox.com/users/${creatorId}/profile`,
      label: creatorName,
      Icon: SiRoblox
    };
  }
  if (creatorType === "group") {
    return {
      key: `creator-group-${creatorId}`,
      url: `https://www.roblox.com/communities/${creatorId}`,
      label: creatorName,
      Icon: FaUsers
    };
  }
  return null;
}

function extractUniverseSocialLinks(raw: unknown): UniverseSocialLink[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const entries: UniverseSocialLink[] = [];
  for (const [platform, value] of Object.entries(record)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const rawUrl = record.url;
      const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!url) continue;
      const title = typeof record.title === "string" ? record.title : null;
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
    notFound();
  }

  const codes = Array.isArray((game as any).codes) ? ((game as any).codes as Code[]) : [];
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
  const canonicalUrl = `${SITE_URL}/codes/${game.slug}`;
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

    const codes = Array.isArray((game as any).codes) ? ((game as any).codes as Code[]) : [];
    const recommended = Array.isArray((game as any).recommended_games)
      ? ((game as any).recommended_games as GameWithCounts[])
      : [];
    const allGames = recommended;
    const universe = (game as any).universe ?? null;

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
  const expiredWithoutSpaces = expired.filter(code => typeof code === "string" && !/\s/.test(code));
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
  const recommended = (allGames ?? [])
    .filter((g) => g.id !== game.id)
    .map((g) => ({
      game: g,
      articleUpdatedAt: (g as any).content_updated_at ?? (g as any).updated_at ?? null
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

  const creatorProfileLink = buildCreatorSocialLink(universe);

  const normalizedUniverseSocialLinks: SocialLinkButton[] = universeSocialLinks
    .map((link) => {
      const url = normalizeUrl(link.url);
      if (!url) return null;
      const meta = UNIVERSE_SOCIAL_META[link.platform] ?? DEFAULT_SOCIAL_META;
      return {
        key: `${link.platform}-${url}`,
        url,
        label: formatSocialLabel(link.platform, link, universeDeveloperName),
        Icon: meta.icon
      };
    })
    .filter((link): link is SocialLinkButton => Boolean(link));

  const robloxSocialButtons: SocialLinkButton[] = [
    ...(creatorProfileLink ? [creatorProfileLink] : []),
    ...normalizedUniverseSocialLinks
  ];

  const fallbackSocialLinks: SocialLinkButton[] = [
    linkMap.community_link
      ? { key: "community", url: linkMap.community_link, label: "Community", Icon: FaUsers }
      : null,
    linkMap.discord_link
      ? { key: "discord", url: linkMap.discord_link, label: "Discord", Icon: FaDiscord }
      : null,
    linkMap.twitter_link
      ? { key: "twitter", url: linkMap.twitter_link, label: "Twitter / X", Icon: RiTwitterXLine }
      : null,
    linkMap.youtube_link
      ? { key: "youtube", url: linkMap.youtube_link, label: "YouTube", Icon: FaYoutube }
      : null
  ].filter((link): link is SocialLinkButton => Boolean(link));

  const socialLinksToDisplay = normalizedUniverseSocialLinks.length
    ? robloxSocialButtons
    : fallbackSocialLinks.length
    ? [...(creatorProfileLink ? [creatorProfileLink] : []), ...fallbackSocialLinks]
    : robloxSocialButtons;
  const shouldShowSocialSection = Boolean(universe || socialLinksToDisplay.length);

  const introMarkdown = game.intro_md ? replaceLinkPlaceholders(game.intro_md, linkMap) : "";
  const redeemMarkdown = game.redeem_md ? replaceLinkPlaceholders(game.redeem_md, linkMap) : "";
  const troubleshootMarkdown = game.troubleshoot_md ? replaceLinkPlaceholders(game.troubleshoot_md, linkMap) : "";
  const rewardsMarkdown = game.rewards_md ? replaceLinkPlaceholders(game.rewards_md, linkMap) : "";
  const descriptionMarkdown = game.description_md ? replaceLinkPlaceholders(game.description_md, linkMap) : "";
  const aboutMarkdown = game.about_game_md ? replaceLinkPlaceholders(game.about_game_md, linkMap) : "";
  const interlinkMarkdown = game.interlinking_ai_copy_md ?? "";

  const redeemSteps = extractHowToSteps(redeemMarkdown || game.redeem_md);

  const [introHtml, redeemHtml, interlinkHtml, troubleshootHtml, rewardsHtml, descriptionHtml, aboutHtml] = await Promise.all([
    introMarkdown ? renderMarkdown(introMarkdown) : "",
    redeemMarkdown ? renderMarkdown(redeemMarkdown) : "",
    interlinkMarkdown ? renderMarkdown(interlinkMarkdown) : "",
    troubleshootMarkdown ? renderMarkdown(troubleshootMarkdown) : "",
    rewardsMarkdown ? renderMarkdown(rewardsMarkdown) : "",
    descriptionMarkdown ? renderMarkdown(descriptionMarkdown) : "",
    aboutMarkdown ? renderMarkdown(aboutMarkdown) : ""
  ]);
  const hasSupplemental = Boolean(troubleshootHtml || rewardsHtml || aboutHtml);

  const canonicalUrl = `${SITE_URL}/codes/${game.slug}`;
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
  const authorMeta =
    game.author && game.author.name
      ? {
          name: game.author.name,
          url: game.author.slug ? `${SITE_URL}/authors/${game.author.slug}` : undefined
        }
      : null;
  const publishedIso = new Date(game.created_at).toISOString();
  const updatedIso = new Date(lastContentUpdate).toISOString();
  const lastCheckedIso = new Date(lastChecked).toISOString();
  const siteBaseUrl = SITE_URL.replace(/\/$/, "");
  const breadcrumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Codes", url: `${SITE_URL.replace(/\/$/, "")}/codes` },
    { name: game.name ?? "Roblox", url: canonicalUrl }
  ];
  const breadcrumbData = JSON.stringify(breadcrumbJsonLd(breadcrumbs));
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Codes", href: "/codes" },
    { label: game.name ?? "Roblox", href: null }
  ];
  const authorBioHtml = game.author?.bio_md ? await renderMarkdown(game.author.bio_md) : "";
  const authorAvatar = game.author ? authorAvatarUrl(game.author, 72) : null;
  const authorProfileUrl = game.author?.slug ? `/authors/${game.author.slug}` : null;
  const authorSameAs = game.author ? Array.from(new Set(collectAuthorSocials(game.author).map((link) => link.url))) : [];
  const authorBioPlain = game.author?.bio_md ? markdownToPlainText(game.author.bio_md) : null;
  const activeCodesItemList = sortedActive.map((code, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: code.code,
    item: {
      "@type": "Product",
      name: `${game.name} code ${code.code}`,
      sku: code.code,
      description: code.rewards_text ?? undefined,
      dateCreated: code.first_seen_at ? new Date(code.first_seen_at).toISOString() : undefined,
      additionalProperty: [
        { "@type": "PropertyValue", name: "code", value: code.code },
        { "@type": "PropertyValue", name: "is_new", value: isCodeWithinNewThreshold(code, nowMs) },
        ...(code.rewards_text
          ? [{ "@type": "PropertyValue", name: "rewards", value: code.rewards_text }]
          : []),
        ...(code.first_seen_at
          ? [{ "@type": "PropertyValue", name: "added_at", value: new Date(code.first_seen_at).toISOString() }]
          : [])
      ]
    }
  }));
  const faqEntries: { question: string; answer: string }[] = [];
  if (hasSupplemental) {
    if (troubleshootMarkdown) {
      const answer = markdownToPlainText(troubleshootMarkdown).trim();
      if (answer) faqEntries.push({ question: "Why codes might fail", answer });
    }
    if (rewardsMarkdown) {
      const answer = markdownToPlainText(rewardsMarkdown).trim();
      if (answer) faqEntries.push({ question: "Rewards from these codes", answer });
    }
    if (aboutMarkdown) {
      const answer = markdownToPlainText(aboutMarkdown).trim();
      if (answer) faqEntries.push({ question: `About ${game.name}`, answer });
    }
    // Social section text
    faqEntries.push({
      question: "How to get new codes fast?",
      answer:
        "Developers usually share codes on their official channels. We monitor them and update this page quickly. You can also check Telegram (@bloxodes), X (@bloxodes), or install the Chrome extension."
    });
  } else if (descriptionMarkdown) {
    const answer = markdownToPlainText(descriptionMarkdown).trim();
    if (answer) faqEntries.push({ question: `About ${game.name}`, answer });
  }
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
              {game.author ? (
                <div className="flex items-center gap-2" itemProp="author" itemScope itemType="https://schema.org/Person">
                  {authorProfileUrl ? <link itemProp="url" href={authorProfileUrl} /> : null}
                  {authorBioPlain ? <meta itemProp="description" content={authorBioPlain} /> : null}
                  {authorSameAs.map((url) => (
                    <link key={url} itemProp="sameAs" href={url} />
                  ))}
                  <img
                    src={authorAvatar || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={game.author.name}
                    className="h-9 w-9 rounded-full border border-border/40 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    Authored by {game.author.slug ? (
                      <Link
                        href={`/authors/${game.author.slug}`}
                        className="font-semibold text-foreground transition hover:text-accent"
                        itemProp="name"
                      >
                        {game.author.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground" itemProp="name">
                        {game.author.name}
                      </span>
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

        <div className="mb-8">
          <ActiveCodes
            codes={sortedActive}
            gameName={game.name}
            lastUpdatedLabel={lastUpdatedFormatted}
            lastCheckedLabel={lastCheckedFormatted}
            lastCheckedRelativeLabel={lastCheckedRelativeLabel}
            coverImage={game.cover_image}
            nowMs={nowMs}
          />
        </div>

        {redeemHtml ? (
          <section className="mb-8" id="redeem" itemProp="articleBody">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(redeemHtml)}
            />
          </section>
        ) : null}
        {interlinkHtml ? (
          <section className="mb-8" id="more-games">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(interlinkHtml)}
            />
          </section>
        ) : null}
        <section className="panel mb-8 space-y-3 px-5 pb-5 pt-0" id="expired-codes">
          <ExpiredCodes codes={expiredWithoutSpaces} gameName={game.name} />
        </section>

        {hasSupplemental ? (
          <>
            {troubleshootHtml ? (
              <section className="mb-8" id="troubleshoot">
                <div
                  className="prose dark:prose-invert max-w-none game-copy"
                  dangerouslySetInnerHTML={processHtmlLinks(troubleshootHtml)}
                />
              </section>
            ) : null}

            {rewardsHtml ? (
              <section className="mb-8" id="rewards">
                <div
                  className="prose dark:prose-invert max-w-none game-copy"
                  dangerouslySetInnerHTML={processHtmlLinks(rewardsHtml)}
                />
              </section>
            ) : null}

            {shouldShowSocialSection ? (
              <section className="mb-8 space-y-4" id={`more-${game.slug}-codes`}>
                <div className="prose dark:prose-invert max-w-none game-copy">
                  <h2>How to Get New Codes Fast</h2>
                  <p>New codes are posted here by the developers:</p>
                </div>
                {socialLinksToDisplay.length ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {socialLinksToDisplay.map(({ key, url, label, Icon }) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        <span>{label}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">We haven't found any official social media links yet.</p>
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

            {aboutHtml ? (
              <section className="mb-8" id="about-game">
                <div
                  className="prose dark:prose-invert max-w-none game-copy"
                  dangerouslySetInnerHTML={processHtmlLinks(aboutHtml)}
                />
              </section>
            ) : null}
          </>
        ) : descriptionHtml ? (
          <section className="mb-8 space-y-4" id="description">
            <div
              className="prose dark:prose-invert max-w-none game-copy"
              dangerouslySetInnerHTML={processHtmlLinks(descriptionHtml)}
            />
          </section>
        ) : null}


        {game.author ? (
          <div className="mt-10">
            <AuthorCard author={game.author} bioHtml={authorBioHtml} />
          </div>
        ) : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                breadcrumbJsonLd(breadcrumbs),
                {
                  "@type": "BlogPosting",
                  url: canonicalUrl,
                  mainEntityOfPage: {
                    "@type": "WebPage",
                    "@id": canonicalUrl
                  },
                  headline: `${game.name} Codes (${monthYear()})`,
                  datePublished: publishedIso,
                  dateModified: updatedIso,
                  image: {
                    "@type": "ImageObject",
                    url: coverImage,
                    thumbnailUrl: coverImage
                  },
                  author: game.author
                    ? {
                        "@type": "Person",
                        name: game.author.name,
                        ...(authorProfileUrl ? { url: `${SITE_URL.replace(/\/$/, "")}${authorProfileUrl}` } : {}),
                        ...(authorBioPlain ? { description: authorBioPlain } : {}),
                        ...(authorSameAs.length ? { sameAs: authorSameAs } : {})
                      }
                    : {
                        "@type": "Organization",
                        name: SITE_NAME,
                        url: SITE_URL
                      },
                  publisher: { "@id": `${SITE_URL.replace(/\/$/, "")}/#organization` },
                  about: {
                    "@type": "VideoGame",
                    name: game.name,
                    operatingSystem: "Roblox"
                  },
                  mainEntity: [
                    ...(redeemSteps.length
                      ? [
                          {
                            "@type": "HowTo",
                            name: `How to redeem ${game.name} codes`,
                            step: redeemSteps.map((text, idx) => ({
                              "@type": "HowToStep",
                              position: idx + 1,
                              text
                            }))
                          }
                        ]
                      : []),
                    ...(faqEntries.length
                      ? [
                          {
                            "@type": "FAQPage",
                            mainEntity: faqEntries.map(({ question, answer }) => ({
                              "@type": "Question",
                              name: question,
                              acceptedAnswer: { "@type": "Answer", text: answer }
                            }))
                          }
                        ]
                      : []),
                    ...(activeCodesItemList.length
                      ? [
                          {
                            "@type": "ItemList",
                            name: `${game.name} active codes`,
                            numberOfItems: activeCodesItemList.length,
                            itemListElement: activeCodesItemList
                          }
                        ]
                      : [])
                  ]
                }
              ]
            })
          }}
        />
        <LazyCodeBlockEnhancer />
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
