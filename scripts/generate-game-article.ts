import "dotenv/config";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import sharp from "sharp";

import { ensureCategoryForGame } from "@/lib/admin/categories";
import { refreshGameCodesWithSupabase } from "@/lib/admin/game-refresh";
import { generateLinktextForGames } from "@/lib/linktext";
import {
  extractPlaceId,
  fetchGenreFromApi,
  fetchGenreFromUniverse,
  scrapeRobloxGameMetadata
} from "@/lib/roblox/game-metadata";
import { scrapeSocialLinksFromSources, type SocialLinks as ScrapedSocialLinks } from "@/lib/social-links";
import { normalizeGameSlug, stripCodesSuffix } from "@/lib/slug";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY!;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX!;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeForMatch = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

type SearchEntry = {
  title: string;
  url: string;
  snippet?: string;
};

type ArticleResponse = {
  intro_md: string;
  redeem_md: string;
  description_md: string;
  meta_description: string;
  game_display_name: string;
};

type ProcessedArticle = ArticleResponse;

type LinkInfo = {
  url: string;
  label?: string;
};

type PlaceholderLinks = {
  roblox_link?: LinkInfo;
  community_link?: LinkInfo;
  discord_link?: LinkInfo;
  twitter_link?: LinkInfo;
  youtube_link?: LinkInfo;
};

function isArticleResponse(value: unknown): value is ArticleResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["intro_md", "redeem_md", "description_md", "meta_description", "game_display_name"].every(
    (key) => typeof candidate[key] === "string" && Boolean(candidate[key])
  );
}

async function googleSearch(query: string, limit = 5): Promise<SearchEntry[]> {
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Search failed: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    items?: { title?: string; link?: string; snippet?: string }[];
  };

  return (
    data.items
      ?.map((item) => ({
        title: item.title ?? "",
        url: item.link ?? "",
        snippet: item.snippet,
      }))
      .filter((item) => item.title && item.url) ?? []
  );
}

const ALLOWED_EXTRA_TITLE_TOKENS = new Set([
  "roblox",
  "code",
  "codes",
  "new",
  "updated",
  "update",
  "working",
  "active",
  "latest",
  "all",
  "free",
  "list",
  "guide",
  "wiki",
  "rewards",
  "bonus",
  "bonuses",
  "gift",
  "gifts",
  "promo",
  "promos",
  "redeem",
  "how",
  "to",
  "get",
  "the",
  "for",
  "of",
  "and",
  "with",
  "best",
  "tips",
  "tricks",
  "today"
]);

const tokenize = (value: string): string[] =>
  normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const isAllowedExtraToken = (token: string): boolean =>
  ALLOWED_EXTRA_TITLE_TOKENS.has(token) || /^20\d{2}$/.test(token);

function titleMatchesGame(title: string, gameName: string): boolean {
  const titleTokens = tokenize(title);
  const gameTokens = tokenize(gameName);

  if (gameTokens.length === 0 || titleTokens.length === 0) {
    return false;
  }

  const counts = new Map<string, number>();
  for (const token of gameTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  for (const token of titleTokens) {
    if (counts.has(token) && (counts.get(token) ?? 0) > 0) {
      counts.set(token, (counts.get(token) ?? 0) - 1);
      continue;
    }

    if (!isAllowedExtraToken(token)) {
      return false;
    }
  }

  return Array.from(counts.values()).every((value) => value === 0);
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (response.ok) return response;
      lastError = new Error(`Fetch failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function findGameCodeArticle(gameName: string, siteSpecifier: string) {
  const { domain, pathFragment } = parseSiteSpecifier(siteSpecifier);

  const queries = [
    `"${gameName}" codes site:${domain}${pathFragment ? ` inurl:${pathFragment}` : ""}`,
    `"${gameName}" Roblox codes site:${domain}${pathFragment ? ` inurl:${pathFragment}` : ""}`,
    `"${gameName}" code list site:${domain}${pathFragment ? ` inurl:${pathFragment}` : ""}`,
  ];

  const visited = new Set<string>();
  const normalizedGame = normalizeForMatch(gameName);

  for (const query of queries) {
    const results = await googleSearch(query, 7);

    for (const entry of results) {
      if (!entry.url) continue;
      if (visited.has(entry.url)) continue;
      visited.add(entry.url);

      if (!/\bcodes?\b/i.test(entry.title)) continue;

      const urlMatches = await validateGameMatch(entry.url, gameName);
      if (urlMatches) {
        return entry.url;
      }

      const normalizedTitle = normalizeForMatch(entry.title);
      if (!normalizedTitle.includes(normalizedGame)) continue;
      if (!titleMatchesGame(entry.title, gameName)) continue;
      if (urlMatches) {
        return entry.url;
      }
    }
  }

  if (domain.includes("robloxden.com")) {
    const slugCandidate = stripCodesSuffix(normalizeGameSlug(gameName, gameName));
    if (slugCandidate) {
      const candidateUrl = `https://robloxden.com/game-codes/${slugCandidate}`;
      if (await validateGameMatch(candidateUrl, gameName)) {
        return candidateUrl;
      }
    }
  }

  return null;
}

function parseSiteSpecifier(value: string): { domain: string; pathFragment: string | null } {
  const parts = value.split("/").filter(Boolean);
  const domain = parts[0] ?? value;
  const pathFragment = parts.slice(1).join("/") || null;
  return { domain, pathFragment };
}

async function validateGameMatch(url: string, gameName: string): Promise<boolean> {
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const dom = new JSDOM(html);
    const { document } = dom.window;

    const title = document.querySelector("meta[property='og:title']")?.getAttribute("content")
      ?? document.querySelector("title")?.textContent
      ?? "";

    const heading = document.querySelector("h1")?.textContent ?? "";

    const combined = `${title}\n${heading}`;
    const titleMatches = titleMatchesGame(combined, gameName);
    if (titleMatches) return true;

    const normalizedGame = normalizeForMatch(gameName);
    const normalizedCombined = normalizeForMatch(combined);
    return normalizedCombined.includes(normalizedGame);
  } catch (error) {
    console.warn(`⚠️ Unable to validate game match for ${url}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const readableText = article?.textContent?.trim();

    if (readableText) {
      return `\n[${url}]\n${readableText}`;
    }

    if (article?.content) {
      const fragment = JSDOM.fragment(article.content);
      const fallbackText = fragment.textContent?.trim();
      if (fallbackText) {
        return `\n[${url}]\n${fallbackText}`;
      }
    }

    return `\n[${url}]\n`;
  } catch {
    console.warn(`⚠️ Failed to fetch ${url}`);
    return "";
  }
}

function resolveHref(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function normalizeExternalLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const resolved = new URL(trimmed);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function extractAnchorLabel(anchor: HTMLAnchorElement | Element | null | undefined): string | undefined {
  if (!anchor) return undefined;
  const raw =
    "textContent" in anchor && typeof anchor.textContent === "string"
      ? anchor.textContent
      : undefined;
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned;
}

function isRobloxExperienceUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("roblox.com")) return false;
    const path = url.pathname.toLowerCase();
    return /^\/(games|game-details|experiences)(\/|$)/.test(path);
  } catch {
    return false;
  }
}

function isRobloxCommunityUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("roblox.com")) return false;
    const path = url.pathname.toLowerCase();
    return /^\/(communities|groups)(\/|$)/.test(path);
  } catch {
    return false;
  }
}

async function fetchCommunityLinkFromRobloxExperience(gameUrl: string): Promise<LinkInfo | null> {
  try {
    const response = await fetchWithRetry(gameUrl);
    const html = await response.text();
    const dom = new JSDOM(html, { url: gameUrl });
    const { document } = dom.window;

    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const prioritized = anchors.filter((anchor) => anchor.classList.contains("text-name") && anchor.classList.contains("text-overflow"));

    const candidates = [...prioritized, ...anchors];
    for (const anchor of candidates) {
      const resolved = resolveHref(anchor.getAttribute("href"), gameUrl);
      if (!resolved) continue;
      if (isRobloxCommunityUrl(resolved)) {
        const label = extractAnchorLabel(anchor);
        return { url: resolved, label };
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to fetch Roblox community link:", error instanceof Error ? error.message : error);
  }
  return null;
}

async function collectRobloxMetadata(robloxLink?: string | null) {
  if (!robloxLink) {
    return { genre: null, subGenre: null, communityLink: null };
  }

  try {
    const scraped = await scrapeRobloxGameMetadata(robloxLink);
    let genre = scraped.genre;
    let subGenre = scraped.subGenre;
    let communityLink = scraped.communityLink;
    const placeId = scraped.placeId ?? extractPlaceId(robloxLink);
    const universeId = scraped.universeId ?? null;

    if ((!genre || !subGenre) && universeId) {
      try {
        const universeData = await fetchGenreFromUniverse(universeId);
        genre = genre ?? universeData.genre;
        subGenre = subGenre ?? universeData.subGenre;
      } catch (error) {
        console.warn("⚠️ Failed to fetch universe metadata:", error instanceof Error ? error.message : error);
      }
    }

    if ((!genre || !subGenre) && placeId) {
      try {
        const fallback = await fetchGenreFromApi(placeId);
        genre = genre ?? fallback.genre;
        subGenre = subGenre ?? fallback.subGenre;
      } catch (error) {
        console.warn("⚠️ Failed to fetch place metadata:", error instanceof Error ? error.message : error);
      }
    }

    return { genre: genre ?? null, subGenre: subGenre ?? null, communityLink: communityLink ?? null };
  } catch (error) {
    console.warn("⚠️ Failed to scrape Roblox metadata:", error instanceof Error ? error.message : error);
    return { genre: null, subGenre: null, communityLink: null };
  }
}

function convertScrapedSocialLinks(links: ScrapedSocialLinks): PlaceholderLinks {
  const toLinkInfo = (value?: string | null): LinkInfo | undefined =>
    value ? { url: value } : undefined;
  return {
    roblox_link: toLinkInfo(links.roblox),
    community_link: toLinkInfo(links.community),
    discord_link: toLinkInfo(links.discord),
    twitter_link: toLinkInfo(links.twitter),
    youtube_link: toLinkInfo(links.youtube)
  };
}

type SectionType = "codeNotWorking" | "whereToFind" | "rewardsOverview";

type SectionConfig = {
  type: SectionType;
  variant?: number;
};

const SECTION_TITLE_VARIANTS: Record<SectionType, Array<(gameName: string) => string>> = {
  codeNotWorking: [
    () => "## Why Codes Might Not Work",
    () => "## Why Your Codes Might Fail",
    (gameName) => `## ${gameName} Codes Not Working?`,
    () => "## Trouble Redeeming Codes?",
    (gameName) => `## Why Is My ${gameName} Code Not Working?`
  ],
  whereToFind: [
    () => "## Where to Find More Codes",
    () => "## Where You Can Find More Codes",
    (gameName) => `## Where You Can Find ${gameName} Codes`,
    () => "## Best Places to Grab More Codes",
    (gameName) => `## Where to Find ${gameName} Codes`
  ],
  rewardsOverview: [
    () => "## What Rewards You Normally Get?",
    () => "## Rewards You Can Usually Expect From These Codes",
    (gameName) => `## What Rewards You Get From ${gameName}`,
    () => "## What Rewards You Get From These Codes",
    () => "## Rewards You Get From These Codes"
  ]
};

function resolveSectionTitle(type: SectionType, gameName: string, variant = 0): string {
  const variants = SECTION_TITLE_VARIANTS[type] ?? [() => "## Additional Details"];
  const resolver = variants[variant % variants.length] ?? variants[0];
  const raw = resolver(gameName).trim();
  return raw.startsWith("##") ? raw : `## ${raw.replace(/^#+\s*/, "")}`;
}

type StandardSectionOptions = {
  codeVariant?: number;
  whereVariant?: number;
  rewardsVariant?: number;
  howVariant?: number;
};

function standardSections({
  codeVariant = 0,
  whereVariant = 0,
  rewardsVariant = 0,
  howVariant = 0
}: StandardSectionOptions = {}): SectionConfig[] {
  return [
    { type: "codeNotWorking", variant: codeVariant },
    { type: "whereToFind", variant: whereVariant },
    { type: "rewardsOverview", variant: rewardsVariant }
  ];
}

// Prompt templates with different intro approaches and description section variations
const PROMPT_TEMPLATES: {
  introGuidance: (gameName: string) => string;
  descriptionSections: SectionConfig[];
}[] = [
  // Template 1: Challenge-focused intro
  {
    introGuidance: (gameName: string) =>
      `Start by talking about a specific challenge or difficult aspect of ${gameName} that players face. Explain how this makes the game engaging but also frustrating at times. Then smoothly transition to how codes help overcome these challenges and make progress easier. Keep it relatable and grounded. No generic statements like "These codes give you free rewards" Be very detailed and every sentence should be game specific that drives the info forward. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 0,
      whereVariant: 0,
      rewardsVariant: 0
    })
  },
  // Template 2: Rewards-first intro
  {
    introGuidance: (gameName: string) =>
      `Start directly with what codes give players - list out 2-3 specific rewards like coins, boosts, or items (The ones that are specific to the game). Then introduce ${gameName} briefly and explain why these rewards matter in the game. Make it punchy and benefit-focused. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 1,
      whereVariant: 2,
      rewardsVariant: 2
    })
  },
  // Template 3: Grind-focused intro
  {
    introGuidance: (gameName: string) =>
      `Talk about the grind in ${gameName} - how much time and effort progression normally takes. Be honest about it. Then explain how codes can speed things up and make the experience more enjoyable. Keep it conversational. Sprinkle some first-hand experience but only in a way that tells the needed info. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 2,
      whereVariant: 3,
      rewardsVariant: 1
    })
  },
  // Template 4: Community-focused intro
  {
    introGuidance: (gameName: string) =>
      `Give clean details of what this game is all about. Narrative should flow like a story. Talk about what makes it stand out. Then naturally lead into how codes are a big part of the community experience and help players stay competitive. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 3,
      whereVariant: 1,
      rewardsVariant: 3
    })
  },
  // Template 5: New player intro
  {
    introGuidance: (gameName: string) =>
      `Write as if talking to someone who just discovered ${gameName}. Briefly explain what the game is about in one sentence, then immediately tell them about codes and why they should use them from the start. Make it welcoming and helpful. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 4,
      whereVariant: 4,
      rewardsVariant: 4
    })
  },
  // Template 6: Update-focused intro
  {
    introGuidance: (gameName: string) =>
      ` Mention how often the ${gameName} get new codes. Talk about how codes often come with these updates and help players access new features or items. Then explain why staying on top of codes matters. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 0,
      whereVariant: 2,
      rewardsVariant: 1
    })
  },
  // Template 7: Competitive angle intro
  {
    introGuidance: (gameName: string) =>
      `Talk about the competitive or strategic elements in ${gameName}. Explain how codes give players an edge or help them keep up with others. Make it about staying relevant in the game. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 1,
      whereVariant: 0,
      rewardsVariant: 2
    })
  },
  // Template 8: Time-saver intro
  {
    introGuidance: (gameName: string) =>
      `Start with how ${gameName} can be time-consuming. Talk about players who want to enjoy the game without spending hours grinding. Then position codes as the solution for efficient progression. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 2,
      whereVariant: 1,
      rewardsVariant: 0
    })
  },
  // Template 9: Excitement-focused intro
  {
    introGuidance: (gameName: string) =>
      `Open with enthusiasm about ${gameName} and what makes it fun. Keep it energetic but genuine. Then talk about how codes add to the excitement by giving free stuff and helping players try new things. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 3,
      whereVariant: 3,
      rewardsVariant: 3
    })
  },
  // Template 10: Problem-solution intro
  {
    introGuidance: (gameName: string) =>
      `Identify a common problem or frustration players have in ${gameName} (like slow progress, expensive items, etc.). Then present codes as a practical solution. Be direct and helpful. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 0,
      whereVariant: 4,
      rewardsVariant: 2
    })
  },
  // Template 11: Genre-focused intro
  {
    introGuidance: (gameName: string) =>
      `Start by talking about the genre or style of ${gameName} (if sources mention it). Explain what type of player would enjoy it. Then connect codes to enhancing that specific gameplay experience. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 1,
      whereVariant: 2,
      rewardsVariant: 4
    })
  },
  // Template 12: Free-to-play angle intro
  {
    introGuidance: (gameName: string) =>
      `Emphasize that ${gameName} is free to play on Roblox. Talk about how codes make it even better by giving free rewards without spending Robux. Make it about getting the most value. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 2,
      whereVariant: 0,
      rewardsVariant: 1
    })
  },
  // Template 13: Social proof intro
  {
    introGuidance: (gameName: string) =>
      `Mention player counts, popularity, or what the community is saying about ${gameName} (only if in sources). Talk about why so many people are playing it. Then explain how codes help both new and experienced players. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 3,
      whereVariant: 1,
      rewardsVariant: 2
    })
  },
  // Template 14: Seasonal/Event intro
  {
    introGuidance: (gameName: string) =>
      `If sources mention any events or seasonal content in ${gameName}, start with that. Otherwise, talk about how the game keeps things fresh. Then explain how codes often tie into special events and limited-time rewards. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 4,
      whereVariant: 3,
      rewardsVariant: 0
    })
  },
  // Template 15: Direct and simple intro
  {
    introGuidance: (gameName: string) =>
      `Keep it simple and direct. Introduce ${gameName} in one sentence. Say what codes do in one sentence. Explain why players should care in one sentence. Then wrap up the intro. No fluff, just clear information. (Only use info from the sources. Feel free to experiment or tweak the template, but only include the info from the source)`,
    descriptionSections: standardSections({
      codeVariant: 0,
      whereVariant: 4,
      rewardsVariant: 4
    })
  }
];

function buildArticlePrompt(gameName: string, sources: string) {
  // Randomly select one of the 15 prompt templates
  const templateIndex = Math.floor(Math.random() * PROMPT_TEMPLATES.length);
  const template = PROMPT_TEMPLATES[templateIndex];
  console.log(`📝 Using prompt template ${templateIndex + 1} of ${PROMPT_TEMPLATES.length}`);
  
  // Build the description sections guidance
  const descriptionGuidance = template.descriptionSections.map((section) => {
    const heading = resolveSectionTitle(section.type, gameName, section.variant);

    switch (section.type) {
      case "codeNotWorking":
        return `   - ${heading}
     Bullet list of real reasons from sources. Keep it very simple, easy to scan, no generic and obvious solutions need to be included. Include all the needed info and reasons that user might be facing the issue. 
     Before the bullet points, write at least a line or two to give cue to the actual points.
     Also, after the points have mentioned, write a line or two to talk to the user to give more context about this if you have or skip.`;
      case "whereToFind":
        return `   - ${heading}
     1–2 short and on-point conversational paragraphs. Use the sources to locate the official Roblox page plus any verified social channels (Discord, Twitter/X, Trello, Roblox Group, etc.).
     Mention each channel by exact name (Discord server title, channel names, Twitter @handle, Roblox group title, etc.) and explain what players can find there.
     Wrap Roblox mentions with [[roblox_link|...]], Discord mentions with [[discord_link|...]], Twitter/X mentions with [[twitter_link|...]], community links with [[community_link|...]], and YouTube mentions with [[youtube_link|...]]. Make sure the anchor text is the real channel or profile name (e.g. [[discord_link|Tower Defense Discord]]).
     If a source clearly references a Discord, Twitter/X, or community link, you must include the corresponding placeholder in this section. If the source does not mention that channel, do not invent it.
     No bullet-points in this section at all. Just conversational paras. Write in as less words as possible, keep it short, info rich and to the point. However write full sentences that feels like friend explaining things to another friend. 
     Also suggest users to bookmark our page with ctrl + D on Windows (CMD + D on mac). Tell them that we will update the article with new working active codes as soon as they dropped.`;
      case "rewardsOverview":
        return `   - ${heading}
     Create a table of typical rewards (from the sources). Include all the reward types we get for this game with clear details, description of each reward, and all the info that makes sense to include in this section. The section should be detailed, in-depth, and everything should be cleanly explained. Write at least a line or two before jumping into table to give cue to the audience.`;
    }
  }).join('\n');

  return `
You are a professional Roblox journalist.
Use ONLY the information from these trusted sources below to write an accurate, detailed, and structured article.
Do NOT invent or guess anything. If something isn't in the sources, skip it. Do not mention or reference the source names or URLs—retell the information in your own words. Sprinkle in personal commentary or first-hand style insights only when they add clear value or show how a player might react to the info, but keep the focus on delivering facts.

Use the link placeholders below instead of raw URLs. Always wrap the exact anchor text in the placeholder format [[placeholder_key|Anchor Text]] and never output the actual URL.
- [[roblox_link|...]] → official Roblox experience page
- [[community_link|...]] → community links players should join or follow
- [[discord_link|...]] → Discord server or channel names
- [[twitter_link|...]] → Twitter/X handles or profiles
- [[youtube_link|...]] → YouTube channels
If we have mentioned the game's social media platform, we need to use the placeholder of that platform. 

=== SOURCES START ===
${sources}
=== SOURCES END ===

Write in clean markdown, no em-dashes, no speculation. The entire article should be between 600–800 words long in average. Keep the language simple, full sentences and like friend talking to another friend. When you need a link, use the placeholders above. Add some human randomness and sprinkles of minor opinions and bring that flow to the entire article talking about previous sections and make it feel like a story and keep it very casual and very human. Do not keywordstuff, write natually and when talking about game, no need to mention gamename everytime, just simply say "in the game" or "This game allows you". 

Sections required:
0. game_display_name – return the official game name exactly as written in the sources (respect capitalization, punctuation, and spacing). Never invent a new name.

1. intro_md – Just 3-5 lines of detailed and cleanly explained intro. Write in simple engish, easy to understand style. Give clean context to users to follow. No generic statements that are obvious. Dig deep and hold the crux and be very specific talking about that partcular game. Every sentence should tell something more to the user. 
   ${template.introGuidance(gameName)}

2. redeem_md – "## How to Redeem ${gameName} Codes" with numbered steps.
   - If any requirements, conditions, or level limits appear anywhere in the sources, summarize them clearly before listing steps.
   - If there are no requirements, write a line or two before the steps, to give cue to the actual steps. 
   - Write step-by-step in numbered list and keep the sentences simple and easy to scan. Do not use : and write like key value pairs, just write simple sentences.
   - Always wrap the instruction to start the experience with [[roblox_link|Launch ${gameName}]].
   - When you ask readers to join or follow a community, wrap the relevant words with [[community_link|...]].
   - If the game does not have codes system yet, no need for step-by-step instructions, just convey the information in clear detail. We can skip the step by step process completely if the game does not have codes system.

3. description_md – include these sections in this exact order:
${descriptionGuidance}

4. meta_description – a single 150–160 character sentence that naturally summarizes the article for search engines. Mention ${gameName} codes and the value players get, keep it friendly, and do not use markdown, placeholders, or quotation marks.

Return valid JSON:
{
  "intro_md": "...",
  "redeem_md": "...",
  "description_md": "...",
  "meta_description": "...",
  "game_display_name": "..."
}
`;
}

async function main() {
  const gameName = process.argv[2];

  if (!gameName) {
    console.error("❌ Please provide a game name.\nExample: npm run generate \"Anime Defenders\"");
    process.exit(1);
  }

  console.log(`🔍 Collecting Google data for "${gameName}"...`);

  const mainQuery = `"${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`;
  const mainResults = await googleSearch(mainQuery, 5);

  const topLinks = mainResults.slice(0, 3).map((entry) => entry.url);
  let fullText = "";
  for (const url of topLinks) {
    console.log(`📖 Reading full page: ${url}`);
    fullText += await fetchArticleText(url);
    await sleep(1500);
  }

  const extraQueries = [
    `how to redeem "${gameName}" Roblox codes (site:beebom.com OR site:destructoid.com OR site:progameguides.com OR site:roblox.com OR site:pcgamesn.com OR site:pockettactics.com OR site:gamerant.com OR site:fandom.com OR site:tryhardguides.com OR site:techwiser.com)`,
    `"${gameName}" Roblox code rewards OR bonuses`,
    `how to play "${gameName}" Roblox guide OR wiki site:fandom.com OR site:roblox.com`,
  ];

  let snippetText = "";
  for (const q of extraQueries) {
    console.log(`🌐 Searching: ${q}`);
    const entries = await googleSearch(q);
    if (!entries.length) continue;

    const formatted = entries
      .map((entry) => {
        const snippetSuffix = entry.snippet ? `\nSnippet: ${entry.snippet}` : "";
        return `Title: ${entry.title}\nURL: ${entry.url}${snippetSuffix}`;
      })
      .join("\n\n");

    snippetText += `\n\n${formatted}`;
    await sleep(1000);
  }

  const combinedSources = `${fullText}\n\n${snippetText}`;

  const [robloxDenSource, beebomSource, destructoidSource] = await Promise.all([
    findGameCodeArticle(gameName, "robloxden.com/game-codes"),
    findGameCodeArticle(gameName, "beebom.com"),
    findGameCodeArticle(gameName, "destructoid.com")
  ]);

  const sourceCandidates = [robloxDenSource, beebomSource, destructoidSource].filter(
    (value): value is string => Boolean(value)
  );

  if (robloxDenSource) {
    console.log(`🔗 Roblox Den source found: ${robloxDenSource}`);
  } else {
    console.log("⚠️ No matching Roblox Den codes article found.");
  }

  if (beebomSource) {
    console.log(`🔗 Beebom source found: ${beebomSource}`);
  } else {
    console.log("⚠️ No matching Beebom codes article found.");
  }

  if (destructoidSource) {
    console.log(`🔗 Destructoid source found: ${destructoidSource}`);
  } else {
    console.log("⚠️ No matching Destructoid codes article found.");
  }

  let socialLinks: PlaceholderLinks = {};
  if (sourceCandidates.length) {
    const socialResult = await scrapeSocialLinksFromSources(sourceCandidates);
    if (socialResult.errors.length) {
      for (const errorMessage of socialResult.errors) {
        console.warn(`⚠️ Social scrape error: ${errorMessage}`);
      }
    }
    socialLinks = convertScrapedSocialLinks(socialResult.links);
  }

  let metadata = await collectRobloxMetadata(socialLinks.roblox_link?.url);

  console.log("🧠 Writing detailed article using GPT-4.1-mini...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    max_tokens: 5000,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildArticlePrompt(gameName, combinedSources) }],
  });

  const raw = completion.choices[0].message?.content ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("⚠️ Could not parse JSON. Raw output:\n", raw);
    throw new Error((error as Error).message || "Model returned invalid JSON.");
  }

  if (!isArticleResponse(parsed)) {
    console.error("⚠️ Missing sections. Raw output:\n", raw);
    throw new Error("Article generation incomplete.");
  }

  const canonicalName = sanitizeGameDisplayName(parsed.game_display_name, gameName);
  let slug = normalizeGameSlug(canonicalName, gameName);

  const { data: existingGame, error: existingError } = await supabase
    .from("games")
    .select("id, is_published, roblox_link, community_link, discord_link, twitter_link, youtube_link, source_url, source_url_2, source_url_3, genre, sub_genre")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingGame?.is_published) {
    console.log(`ℹ️ "${canonicalName}" already exists and is published. Skipping generation.`);
    return;
  }

  const robloxExperienceLink = socialLinks.roblox_link?.url ?? existingGame?.roblox_link ?? undefined;
  if ((!metadata.genre || !metadata.subGenre) && robloxExperienceLink && !socialLinks.roblox_link) {
    metadata = await collectRobloxMetadata(robloxExperienceLink);
  }

  if (!socialLinks.community_link && metadata.communityLink) {
    socialLinks.community_link = { url: metadata.communityLink };
  }

  if (!socialLinks.community_link && robloxExperienceLink) {
    const scrapedCommunityLink = await fetchCommunityLinkFromRobloxExperience(robloxExperienceLink);
    if (scrapedCommunityLink) {
      socialLinks.community_link = scrapedCommunityLink;
      console.log(
        `🤖 Extracted community link from Roblox page: ${scrapedCommunityLink.url}${
          scrapedCommunityLink.label ? ` (${scrapedCommunityLink.label})` : ""
        }`
      );
    }
  }

  const defaultLabels: Record<keyof PlaceholderLinks, string> = {
    roblox_link: `${canonicalName} on Roblox`,
    community_link: `${canonicalName} Community`,
    discord_link: `${canonicalName} Discord`,
    twitter_link: `${canonicalName} Twitter`,
    youtube_link: `${canonicalName} YouTube Channel`,
  };

  const buildLink = (
    preferred: LinkInfo | undefined,
    fallbackUrl: string | null | undefined,
    fallbackLabel: string
  ): LinkInfo | undefined => {
    if (preferred?.url) {
      const label = preferred.label?.trim() || fallbackLabel;
      return { url: preferred.url, label };
    }
    if (fallbackUrl) {
      return { url: fallbackUrl, label: fallbackLabel };
    }
    return undefined;
  };

  const resolvedLinks: PlaceholderLinks = {
    roblox_link: buildLink(socialLinks.roblox_link, existingGame?.roblox_link, defaultLabels.roblox_link),
    community_link: buildLink(socialLinks.community_link, existingGame?.community_link, defaultLabels.community_link),
    discord_link: buildLink(socialLinks.discord_link, existingGame?.discord_link, defaultLabels.discord_link),
    twitter_link: buildLink(socialLinks.twitter_link, existingGame?.twitter_link, defaultLabels.twitter_link),
    youtube_link: buildLink(socialLinks.youtube_link, existingGame?.youtube_link, defaultLabels.youtube_link),
  };

  if (!resolvedLinks.community_link && metadata.communityLink) {
    resolvedLinks.community_link = { url: metadata.communityLink, label: defaultLabels.community_link };
  }

  const article = applyLinkPlaceholders(parsed, canonicalName, resolvedLinks);

  const name = article.game_display_name;
  slug = normalizeGameSlug(name, slug);

  console.log(`📦 Saving article for "${name}"...`);
  const insertPayload: Record<string, unknown> = {
    name,
    slug,
    intro_md: article.intro_md,
    redeem_md: article.redeem_md,
    description_md: article.description_md,
    seo_description: article.meta_description,
    is_published: true,
  };

  if (robloxDenSource) insertPayload.source_url = robloxDenSource;
  if (beebomSource) insertPayload.source_url_2 = beebomSource;
  if (destructoidSource) insertPayload.source_url_3 = destructoidSource;
  if (resolvedLinks.roblox_link) insertPayload.roblox_link = resolvedLinks.roblox_link.url;
  if (resolvedLinks.community_link) insertPayload.community_link = resolvedLinks.community_link.url;
  if (resolvedLinks.discord_link) insertPayload.discord_link = resolvedLinks.discord_link.url;
  if (resolvedLinks.twitter_link) insertPayload.twitter_link = resolvedLinks.twitter_link.url;
  if (resolvedLinks.youtube_link) insertPayload.youtube_link = resolvedLinks.youtube_link.url;

  const finalGenre = metadata.genre ?? existingGame?.genre ?? null;
  const finalSubGenre = metadata.subGenre ?? existingGame?.sub_genre ?? null;
  if (finalGenre) insertPayload.genre = finalGenre;
  if (finalSubGenre) insertPayload.sub_genre = finalSubGenre;

  const upsert = await supabase
    .from("games")
    .upsert(insertPayload, { onConflict: "slug" })
    .select("id")
    .maybeSingle();

  if (upsert.error) throw upsert.error;
  const gameId = upsert.data?.id ?? existingGame?.id;
  console.log(`✅ "${name}" saved successfully (${slug})`);

  if (!gameId) {
    console.warn(`⚠️ Unable to determine game id for "${name}". Skipping category sync.`);
  } else {
    try {
      await ensureCategoryForGame(supabase, { id: gameId, slug, name });
    } catch (ensureError) {
      console.warn(
        `⚠️ Failed to ensure category for "${name}":`,
        ensureError instanceof Error ? ensureError.message : ensureError
      );
    }
  }

  try {
    await generateLinktextForGames(supabase, { slugs: [slug], overwrite: false, limit: 1 });
  } catch (linktextError) {
    console.warn(
      "⚠️ Failed to update linktext:",
      linktextError instanceof Error ? linktextError.message : linktextError
    );
  }

  const coverSourceLink = resolvedLinks.roblox_link?.url ?? existingGame?.source_url ?? null;
  await maybeAttachCoverImage({ slug, name, id: gameId ?? undefined, robloxLink: coverSourceLink });
  await refreshCodesForGame(slug);
}

main().catch((error) => {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
async function refreshCodesForGame(slug: string) {
  if (!slug) {
    console.log("⚠️ Missing slug, skipping post-insert refresh.");
    return;
  }

  const { data: gameRecord, error: fetchError } = await supabase
    .from("games")
    .select("id, slug, source_url, source_url_2, source_url_3")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchError) {
    console.error(`⚠️ Unable to load game for ${slug}:`, fetchError.message);
    return;
  }

  if (!gameRecord) {
    console.log(`⚠️ No game found for slug ${slug}. Skipping refresh.`);
    return;
  }

  console.log(`🔁 Syncing codes for ${slug}...`);
  const refreshResult = await refreshGameCodesWithSupabase(supabase, gameRecord);

  if (!refreshResult.success) {
    console.error(`⚠️ Failed to sync codes for ${slug}: ${refreshResult.error}`);
    return;
  }

  const removedNote = refreshResult.removed ? `, removed ${refreshResult.removed}` : "";
  console.log(
    `✔ ${slug} — ${refreshResult.upserted} codes upserted (found ${refreshResult.found}${removedNote}, expired ${refreshResult.expired})`
  );
}

function applyLinkPlaceholders(article: ArticleResponse, gameName: string, links: PlaceholderLinks): ProcessedArticle {
  const displayName = sanitizeGameDisplayName(article.game_display_name, gameName);
  let intro = article.intro_md;
  let redeem = links.roblox_link ? ensureLaunchPlaceholder(article.redeem_md, displayName) : article.redeem_md;
  let description = article.description_md;
  const metaDescription = formatMetaDescription(article.meta_description, displayName);

  const hasPlaceholder = (key: keyof PlaceholderLinks) => {
    const token = new RegExp(`\\[\\[${key}\\|`, "i");
    return token.test(intro) || token.test(redeem) || token.test(description);
  };

  const defaultLabelForKey = (key: keyof PlaceholderLinks): string => {
    switch (key) {
      case "roblox_link":
        return `${displayName} on Roblox`;
      case "community_link":
        return `${displayName} Community`;
      case "discord_link":
        return `${displayName} Discord`;
      case "twitter_link":
        return `${displayName} Twitter`;
      case "youtube_link":
        return `${displayName} YouTube Channel`;
      default:
        return displayName;
    }
  };

  const wrapWithRegex = (value: string, regex: RegExp, key: keyof PlaceholderLinks, label: string) => {
    const pattern = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      const full = match[0];
      const index = match.index;
      const before = value.slice(Math.max(0, index - 2), index);
      if (before.includes("[[")) {
        continue;
      }
      const replacement = `[[${key}|${label}]]`;
      const updated = value.slice(0, index) + replacement + value.slice(index + full.length);
      return { applied: true, value: updated };
    }
    return { applied: false, value };
  };

  const wrapWithKeyword = (value: string, keyword: string, key: keyof PlaceholderLinks, label: string) => {
    const lower = value.toLowerCase();
    const target = keyword.toLowerCase();
    const index = lower.indexOf(target);
    if (index === -1) return { applied: false, value };
    if (index > 0) {
      const prev = value[index - 1];
      const prev2 = value[index - 2] ?? "";
      if (prev === "[" || prev === "|" || (prev === ":" && prev2 === "|")) {
        return { applied: false, value };
      }
    }
    const replacement = `[[${key}|${label}]]`;
    const updated = value.slice(0, index) + replacement + value.slice(index + keyword.length);
    return { applied: true, value: updated };
  };

  const appendSentence = (value: string, sentence: string) => {
    const trimmed = value.trimEnd();
    const separator = trimmed.length ? "\n\n" : "";
    return `${trimmed}${separator}${sentence}`;
  };

  const ensurePlaceholder = (
    key: keyof PlaceholderLinks,
    keywords: string[],
    regexes: RegExp[],
    buildFallback: (label: string) => string
  ) => {
    const link = links[key];
    if (!link?.url) return;
    if (hasPlaceholder(key)) return;

    const label = link.label?.trim() || defaultLabelForKey(key);
    const keywordPool = Array.from(new Set([label, ...keywords])).filter(Boolean) as string[];

    for (const regex of regexes) {
      let result = wrapWithRegex(description, regex, key, label);
      if (result.applied) {
        description = result.value;
        return;
      }
      result = wrapWithRegex(redeem, regex, key, label);
      if (result.applied) {
        redeem = result.value;
        return;
      }
      result = wrapWithRegex(intro, regex, key, label);
      if (result.applied) {
        intro = result.value;
        return;
      }
    }

    for (const keyword of keywordPool) {
      let result = wrapWithKeyword(description, keyword, key, label);
      if (result.applied) {
        description = result.value;
        return;
      }
      result = wrapWithKeyword(redeem, keyword, key, label);
      if (result.applied) {
        redeem = result.value;
        return;
      }
      result = wrapWithKeyword(intro, keyword, key, label);
      if (result.applied) {
        intro = result.value;
        return;
      }
    }

    description = appendSentence(description, buildFallback(label));
  };

  ensurePlaceholder(
    "roblox_link",
    [displayName],
    [],
    (label) => `Visit [[roblox_link|${label}]] to hop in and start playing.`
  );
  ensurePlaceholder(
    "community_link",
    ["community", "group"],
    [/Roblox\s+community/i],
    (label) => `Join [[community_link|${label}]] to catch every update.`
  );
  ensurePlaceholder(
    "discord_link",
    ["Discord"],
    [/\bdiscord\b/i],
    (label) => `Chat with other players in [[discord_link|${label}]].`
  );
  ensurePlaceholder(
    "twitter_link",
    ["Twitter", "X"],
    [/@[a-z0-9_]{3,}/i],
    (label) => `Follow [[twitter_link|${label}]] for code drops.`
  );
  ensurePlaceholder(
    "youtube_link",
    ["YouTube", "channel"],
    [/\byoutube\b/i],
    (label) => `Watch new showcases on [[youtube_link|${label}]].`
  );

  return {
    intro_md: intro,
    redeem_md: redeem,
    description_md: description,
    meta_description: metaDescription,
    game_display_name: displayName,
  };
}

function ensureLaunchPlaceholder(markdown: string, gameName: string): string {
  if (markdown.includes("[[roblox_link|")) {
    return markdown;
  }

  const escapedName = escapeRegExp(gameName);
  const pattern = new RegExp(`Launch\\s+(?:the\\s+)?${escapedName}`, "gi");

  if (!pattern.test(markdown)) {
    return markdown;
  }

  return markdown.replace(pattern, (match) => `[[roblox_link|${match}]]`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatMetaDescription(raw: string, gameName: string): string {
  const withoutPlaceholders = raw.replace(/\[\[[a-z0-9_]+\|([^\]]+)\]\]/gi, "$1");
  const withoutQuotes = withoutPlaceholders.replace(/["“”]+/g, "");
  const normalized = withoutQuotes.replace(/\s+/g, " ").trim();
  const fallback = `Discover the latest ${gameName} codes, rewards, and easy redemption tips.`;
  const base = normalized.length ? normalized : fallback;
  if (base.length <= 160) {
    return base;
  }
  const sliceLimit = 159;
  let truncated = base.slice(0, sliceLimit);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 120) {
    truncated = truncated.slice(0, lastSpace);
  }
  return `${truncated.trim()}…`;
}

function sanitizeGameDisplayName(raw: string | undefined, fallback: string): string {
  const fallbackValue = fallback.trim();
  if (!raw) return fallbackValue;
  const cleaned = raw
    .replace(/\[\[[a-z0-9_]+\|([^\]]+)\]\]/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length ? cleaned : fallbackValue;
}

async function maybeAttachCoverImage(game: { slug: string; name: string; id?: string; robloxLink?: string | null }) {
  if (!process.env.SUPABASE_MEDIA_BUCKET) {
    console.log("⚠️ SUPABASE_MEDIA_BUCKET not configured. Skipping cover image upload.");
    return;
  }

  const existing = await supabase
    .from("games")
    .select("id, cover_image")
    .eq("slug", game.slug)
    .maybeSingle();

  if (existing.error) {
    console.error("⚠️ Failed to check existing cover image:", existing.error.message);
    return;
  }

  const gameId = game.id ?? existing.data?.id ?? null;

  if (!gameId) {
    console.error("⚠️ Game record not found when preparing cover image.");
    return;
  }

  const coverImage = existing.data?.cover_image;
  if (coverImage) {
    console.log("ℹ️ Cover image already exists. Skipping upload.");
    return;
  }

  console.log("🖼️ Searching for cover image...");
  let imageUrl: string | null = null;
  if (game.robloxLink) {
    imageUrl = await fetchRobloxExperienceThumbnail(game.robloxLink);
  }

  if (!imageUrl) {
    imageUrl = await findRobloxImageUrl(game.name);
  }

  if (!imageUrl) {
    console.log("⚠️ No suitable image found.");
    return;
  }

  try {
    const uploadedUrl = await downloadResizeAndUploadImage({
      imageUrl,
      slug: game.slug,
      gameName: game.name,
    });

    if (!uploadedUrl) {
      console.log("⚠️ Upload failed or no URL returned.");
      return;
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({ cover_image: uploadedUrl })
      .eq("id", gameId);

    if (updateError) {
      console.error("⚠️ Failed to store cover image URL:", updateError.message);
      return;
    }

    console.log("✅ Cover image uploaded and stored.");
  } catch (err) {
    console.error("⚠️ Could not attach cover image:", err instanceof Error ? err.message : err);
  }
}

async function fetchRobloxExperienceThumbnail(gameUrl: string): Promise<string | null> {
  try {
    const viaApi = await fetchRobloxThumbnailViaApi(gameUrl);
    if (viaApi) {
      return viaApi;
    }

    const response = await fetch(gameUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: gameUrl });
    const { document } = dom.window;

    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    if (ogImage) {
      try {
        return new URL(ogImage, gameUrl).toString();
      } catch {
        /* ignore */
      }
    }

    const primaryImage = document.querySelector("img") as HTMLImageElement | null;
    if (primaryImage?.src) {
      try {
        return new URL(primaryImage.src, gameUrl).toString();
      } catch {
        /* ignore */
      }
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Failed to fetch Roblox thumbnail:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchRobloxThumbnailViaApi(gameUrl: string): Promise<string | null> {
  try {
    const placeMatch = gameUrl.match(/roblox\.com\/(?:games|game-details)\/(\d+)/i);
    const placeId = placeMatch ? placeMatch[1] : null;
    if (!placeId) return null;

    const placeDetailsRes = await fetch(
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );

    if (!placeDetailsRes.ok) return null;
    const placeDetails = await placeDetailsRes.json();
    const universeId = Array.isArray(placeDetails) && placeDetails[0]?.universeId;
    if (!universeId) return null;

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/games/multiget-thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );

    if (!thumbRes.ok) return null;
    const thumbs = await thumbRes.json();
    const imageUrl = thumbs?.data?.[0]?.imageUrl;
    return typeof imageUrl === "string" ? imageUrl : null;
  } catch (error) {
    console.warn("⚠️ Roblox thumbnail API failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function findRobloxImageUrl(gameName: string): Promise<string | null> {
  const query = `site:roblox.com ${gameName} game`;
  const results = await googleSearch(query, 4);

  for (const entry of results) {
    if (!entry.url) continue;
    if (!/roblox\.com\//i.test(entry.url)) continue;

    const image = await fetchPrimaryImageFromPage(entry.url);
    if (image) return image;
    await sleep(1000);
  }

  return null;
}

async function fetchPrimaryImageFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const metaOg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    if (metaOg?.content) return metaOg.content;

    const metaTwitter = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
    if (metaTwitter?.content) return metaTwitter.content;

    const img = document.querySelector("img") as HTMLImageElement | null;
    if (img?.src) return img.src;
  } catch (error) {
    console.warn("⚠️ Failed to extract image from page", url, error);
  }

  return null;
}

async function downloadResizeAndUploadImage(params: {
  imageUrl: string;
  slug: string;
  gameName: string;
}): Promise<string | null> {
  const response = await fetch(params.imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    console.warn("⚠️ Failed to download image:", response.statusText);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const resized = await sharp(buffer)
    .resize(1200, 675, { fit: "cover", position: "attention" })
    .webp({ quality: 90, effort: 4 })
    .toBuffer();

  const fileBase = params.gameName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "") || params.slug;

  const fileName = `${fileBase}-codes.webp`;
  const path = `games/${params.slug}/${fileName}`;

  const bucket = process.env.SUPABASE_MEDIA_BUCKET!;
  const storageClient = supabase.storage.from(bucket);

  const { error } = await storageClient.upload(path, resized, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    console.error("⚠️ Failed to upload cover image:", error.message);
    return null;
  }

  const publicUrl = storageClient.getPublicUrl(path);
  return publicUrl.data.publicUrl;
}
