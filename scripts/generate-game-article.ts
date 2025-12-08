import "dotenv/config";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import sharp from "sharp";

import { sanitizeCodeDisplay, normalizeCodeKey } from "@/lib/code-normalization";
import { getCodeDisplayPriority, scrapeSources } from "@/lib/scraper";
import { extractPlaceId, scrapeRobloxGameMetadata } from "@/lib/roblox/game-metadata";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";
import { scrapeSocialLinksFromSources, type SocialLinks as ScrapedSocialLinks } from "@/lib/social-links";
import { slugify, stripCodesSuffix } from "@/lib/slug";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

let cachedAuthorIds: string[] | null = null;

async function pickAuthorId(): Promise<string | null> {
  if (!cachedAuthorIds) {
    const { data, error } = await supabase.from("authors").select("id");
    if (error) {
      console.warn("⚠️ Unable to load authors:", error.message);
      cachedAuthorIds = [];
    } else {
      cachedAuthorIds = (data ?? [])
        .map((author) => author.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  }

  if (!cachedAuthorIds || cachedAuthorIds.length === 0) {
    console.warn("⚠️ No authors available; skipping author assignment.");
    return null;
  }

  const authorIds = cachedAuthorIds;
  const index = Math.floor(Math.random() * authorIds.length);
  return authorIds[index] ?? null;
}

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY!;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX!;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeForMatch = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function normalize(str?: string | null): string | null {
  if (!str) return null;
  const cleaned = str.trim();
  return cleaned.length ? cleaned : null;
}

const devKey = (universe?: UniverseMeta | null): string | null => {
  if (!universe) return null;
  if (universe.creator_id != null) return `id:${universe.creator_id}`;
  const name = normalize(universe.creator_name);
  return name ? `name:${name.toLowerCase()}` : null;
};

const genreKey = (universe?: UniverseMeta | null): string | null => {
  if (!universe) return null;
  const g1 = normalize(universe.genre_l1);
  if (g1) return g1.toLowerCase();
  const g2 = normalize(universe.genre_l2);
  return g2 ? g2.toLowerCase() : null;
};

const sortCandidates = (list: InterlinkGame[]): InterlinkGame[] =>
  [...list].sort((a, b) => {
    const aLinks = a.internal_links ?? 0;
    const bLinks = b.internal_links ?? 0;
    if (aLinks !== bLinks) return aLinks - bLinks;
    return a.name.localeCompare(b.name);
  });

type SearchEntry = {
  title: string;
  url: string;
  snippet?: string;
};

type ArticleResponse = {
  intro_md: string;
  redeem_md: string;
  meta_description: string;
  game_display_name: string;
  troubleshoot_md: string;
  rewards_md: string;
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

type ExistingGameRecord = {
  id: string;
  slug: string;
  author_id: string | null;
  is_published: boolean;
  roblox_link: string | null;
  community_link: string | null;
  discord_link: string | null;
  twitter_link: string | null;
  youtube_link: string | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  universe_id: number | null;
};

type UniverseMeta = {
  universe_id: number | null;
  creator_id: number | null;
  creator_name: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
};

type InterlinkGame = {
  id: string;
  name: string;
  slug: string;
  internal_links: number | null;
  is_published: boolean;
  universe: UniverseMeta | null;
};

type InterlinkGameQuery = Omit<InterlinkGame, "universe"> & {
  universe: UniverseMeta | UniverseMeta[] | null;
};

type InterlinkPromptContext = {
  game: { id: string; name: string; slug: string };
  developer: string | null;
  genre: string | null;
  basis: { developer: boolean; genre: boolean };
  picks: { id: string; slug: string; name: string; basis: "developer" | "genre" }[];
};

const normalizeInterlinkGame = (row: InterlinkGameQuery): InterlinkGame => ({
  ...row,
  universe: Array.isArray(row.universe) ? row.universe[0] ?? null : row.universe ?? null
});

function isArticleResponse(value: unknown): value is ArticleResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["intro_md", "redeem_md", "troubleshoot_md", "rewards_md", "meta_description", "game_display_name"].every(
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

async function generateInterlinkingForGame(params: {
  gameId: string | null | undefined;
  gameName: string;
  gameSlug: string;
  universeId: number | null;
}): Promise<{
  copy: string;
  meta: Record<string, unknown>;
  increments: Array<{ id: string; internal_links: number }>;
} | null> {
  const { gameId, gameName, gameSlug } = params;
  if (!gameId) return null;

  const baseSelect = `
    id,
    name,
    slug,
    internal_links,
    is_published,
    universe:roblox_universes(
      universe_id,
      creator_id,
      creator_name,
      genre_l1,
      genre_l2
    )
  `;

  const { data: targetRow, error: targetError } = await supabase
    .from("games")
    .select(baseSelect)
    .eq("id", gameId)
    .maybeSingle();
  if (targetError) {
    console.warn("⚠️ Failed to load target game for interlinking:", targetError.message);
    return null;
  }
  const targetGame = targetRow
    ? normalizeInterlinkGame(targetRow as InterlinkGameQuery)
    : null;
  if (!targetGame) return null;

  const { data: publishedRows, error: publishedError } = await supabase
    .from("games")
    .select(baseSelect)
    .eq("is_published", true);
  if (publishedError) {
    console.warn("⚠️ Failed to load published games for interlinking:", publishedError.message);
    return null;
  }

  const allGames: InterlinkGame[] = [];
  const seen = new Set<string>();
  for (const row of publishedRows ?? []) {
    const normalized = normalizeInterlinkGame(row as InterlinkGameQuery);
    allGames.push(normalized);
    seen.add(normalized.id);
  }
  if (!seen.has(targetGame.id)) {
    allGames.push(targetGame);
  }

  const baseLinks = new Map<string, number>();
  for (const g of allGames) baseLinks.set(g.id, g.internal_links ?? 0);

  const byDev = new Map<string, InterlinkGame[]>();
  const byGenre = new Map<string, InterlinkGame[]>();
  for (const g of allGames) {
    const dk = devKey(g.universe);
    if (dk) {
      if (!byDev.has(dk)) byDev.set(dk, []);
      byDev.get(dk)!.push(g);
    }
    const gk = genreKey(g.universe);
    if (gk) {
      if (!byGenre.has(gk)) byGenre.set(gk, []);
      byGenre.get(gk)!.push(g);
    }
  }

  const dk = devKey(targetGame.universe);
  const gk = genreKey(targetGame.universe);
  const devCandidates = dk ? sortCandidates((byDev.get(dk) || []).filter((g) => g.id !== targetGame.id)) : [];
  const genreCandidates = gk ? sortCandidates((byGenre.get(gk) || []).filter((g) => g.id !== targetGame.id)) : [];

  const picks: { game: InterlinkGame; basis: "developer" | "genre" }[] = [];
  const devQueue = [...devCandidates];
  const genreQueue = [...genreCandidates];

  while (picks.length < 4 && (devQueue.length || genreQueue.length)) {
    const nextDev = devQueue[0];
    const nextGenre = genreQueue[0];
    const pickDev = nextDev && (!nextGenre || (nextDev.internal_links ?? 0) <= (nextGenre.internal_links ?? 0));
    const next = pickDev ? devQueue.shift() : genreQueue.shift();
    if (!next) break;
    picks.push({ game: next, basis: pickDev ? "developer" : "genre" });
  }

  if (!picks.length) return null;

  const devName = normalize(targetGame.universe?.creator_name);
  const genreLabel = normalize(targetGame.universe?.genre_l1) || normalize(targetGame.universe?.genre_l2);

  const promptContext: InterlinkPromptContext = {
    game: { id: gameId, name: gameName, slug: gameSlug },
    developer: devName || null,
    genre: genreLabel || null,
    basis: {
      developer: Boolean(devCandidates.length),
      genre: Boolean(genreCandidates.length)
    },
    picks: picks.map((p) => ({
      id: p.game.id,
      slug: p.game.slug,
      name: p.game.name,
      basis: p.basis
    }))
  };

  const copy = await generateInterlinkCopy(promptContext);
  if (!copy) return null;

  const meta: Record<string, unknown> = {
    generated_by: "generate-game-article",
    generated_at: new Date().toISOString(),
    version: 2,
    prompt_context: promptContext
  };

  const increments = picks.map(({ game }) => ({
    id: game.id,
    internal_links: (baseLinks.get(game.id) ?? 0) + 1
  }));

  return { copy, meta, increments };
}

async function generateInterlinkCopy(context: InterlinkPromptContext): Promise<string | null> {
  if (!context.picks.length) return null;

  const system = [
    "You are writing one short interlinking sentence for a Roblox codes page.",
    "Tone: crisp, human, not templated, no fluff, 1-2 sentences max.",
    "Link format must be Markdown with inline links: [Game Name codes](/codes/slug).",
    "If there are developer picks, mention they are from the same developer.",
    "If there are genre picks, mention they are genre-similar.",
    "Do not invent games; only use the provided picks.",
    "Do not repeat the game name of the page; focus on alternatives.",
    "Avoid numbered lists or bullets."
  ].join(" ");

  const devLinks = context.picks.filter((p) => p.basis === "developer").map((p) => `[${p.name} codes](/codes/${p.slug})`);
  const genreLinks = context.picks.filter((p) => p.basis === "genre").map((p) => `[${p.name} codes](/codes/${p.slug})`);

  const user = {
    game: context.game,
    developer: context.developer,
    genre: context.genre,
    developer_picks: devLinks,
    genre_picks: genreLinks
  };

  const completion = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) }
    ]
  });

  const text = (completion.output_text ?? "").trim();
  if (!text) return null;
  return text;
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
    const slugCandidate = stripCodesSuffix(slugify(gameName));
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
    return { communityLink: null };
  }

  try {
    const scraped = await scrapeRobloxGameMetadata(robloxLink);
    const communityLink = scraped.communityLink;
    return { communityLink: communityLink ?? null };
  } catch (error) {
    console.warn("⚠️ Failed to scrape Roblox metadata:", error instanceof Error ? error.message : error);
    return { communityLink: null };
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

type SectionType = "codeNotWorking" | "rewardsOverview";

const SECTION_TITLE_VARIANTS: Record<SectionType, Array<(gameName: string) => string>> = {
  codeNotWorking: [
    () => "## Why Codes Might Not Work",
    () => "## Why Your Codes Might Fail",
    (gameName) => `## ${gameName} Codes Not Working?`,
    () => "## Trouble Redeeming Codes?",
    (gameName) => `## Why Is My ${gameName} Code Not Working?`
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

function buildArticlePrompt(gameName: string, sources: string) {
  const troubleshootHeading = resolveSectionTitle("codeNotWorking", gameName, 0);
  const rewardsHeading = resolveSectionTitle("rewardsOverview", gameName, 0);
  const redeemHeading = `## How to Redeem ${gameName} Codes`;

  return `
You are a Roblox player and a good friendly writer who is writing an article on ${gameName} Codes. Write the article in simple english, easy to understand style and most importantly information rich. Use only the details from the provided script and write only the section asked.

Rules:
- Keep the structure to intro_md, redeem_md, rewards_md, troubleshoot_md, and meta_description.
- no generic words like This is a existing game or you will love this game is needed. Focus on the game and make sure every sentence adds more value to use who already plays the game.
- If something is missing from sources, leave it out instead of guessing.
- Meta description must be 150-160 characters, no generic claims, write unconvetional and very human and unique meta descriptions for each game.
- All the sections should have full sentences, info rich sentences that are engaging.
- Start troubleshoot_md with "${troubleshootHeading}".
- Start rewards_md with "${rewardsHeading}".
- Start redeem_md with "${redeemHeading}".
- Should leave out anything that is generic in nature and common for all codes, focus on the unique game specific aspect and keep everything cleanly readbale, informational. 
- Write full sentences and easy to read and understand style, but write in as less words as possible.
- Do not hype up things, keep it informational, friendly and engaging.
- Do not include any generic or templated writing.
- Spinkle in some first-hand experience that only a player who played the game would know. 
- Only use the placeholder [[roblox_link|Launch ${gameName}]] when telling players to start the game in the redeem/how-to steps. Do not use any other placeholders; use plain text everywhere else (including social mentions).

Source excerpts:
${sources}

Return valid JSON with these keys:
{
  "intro_md": "Just casually talk to the user with a small intro giving clear context to the user in simple english and clean story like flow. Talk about the game, codes, rewards or anything that hooks the audience into reading the entire article. Don't drag and make sure every sentence adds more value to the user and avoid any generic claims. Keep things grounded, friendly, factual and bit professional.  Write like a Roblox ${gameName} player that is writing for another player who plays the game. Write as less words as possible, but make sure you have given clean context in a relaxed way. Include the keyword ${gameName} codes only one time in a natural way.",
  "redeem_md": "Start with ${JSON.stringify(redeemHeading)} and follow with numbered steps. If any requirements, conditions, or level limits appear anywhere in the sources, summarize them clearly before listing steps. If there are no requirements, write a line or two before the steps, to give cue to the actual steps. Write step-by-step in numbered list and keep the sentences simple and easy to scan. Do not use : and write like key value pairs, just write simple sentences. Always wrap the instruction to start the experience with [[roblox_link|Launch ${gameName}]]. Use plain text for any social mentions; no other placeholders besides the Roblox launch line. If the game does not have codes system yet, no need for step-by-step instructions, just convey the information in clear detail. We can skip the step by step process completely if the game does not have codes system.",
  "rewards_md": "Start with ${JSON.stringify(rewardsHeading)} then Create a table of typical rewards (from the sources). Include all the reward types we get for this game with clear details,and a small description of each reward. Keep it very informational, full sentences, clean to understand, but write in as less words as possible. Before the table, write a line or two to give cue to the users. Do not include any generic or templated writing. Always write things that are unique to the game and leave out everything that is generic in nature like rewards help you progress faster. Leave out the ovbious and focus on the depth and information.",
  "troubleshoot_md": "Start with ${JSON.stringify(troubleshootHeading)} and write why codes might fail and how to fix it. Anything that is generic in nature should be just covered in para style and in one word. But if there are any game specific issues like reaching a specific level or something like that, only then it needs to include them in the bullet list. Even if the list only has 1, include only the unique ones and do not repeat anything. Always keep things direct and try to tell in as less words as possible. (No generic reasons should get into bullet points",
  "meta_description": "150-160 character, plain sentence mentioning ${gameName} codes and the value players get. No generic claims, write unconvetional and very human and unique meta descriptions for each game.",
  "game_display_name": "Return the official game name exactly as written in the sources (respect capitalization, punctuation, and spacing). Never invent a new name."
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
  let slug = slugify(canonicalName || gameName);

  let existingGame: ExistingGameRecord | null = null;
  {
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, slug, author_id, is_published, roblox_link, community_link, discord_link, twitter_link, youtube_link, source_url, source_url_2, source_url_3, universe_id"
    )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    existingGame = (data as ExistingGameRecord | null) ?? null;
  }

  if (existingGame?.is_published) {
    console.log(`ℹ️ "${canonicalName}" already exists and is published. Skipping generation.`);
    return;
  }

  const robloxExperienceLink = socialLinks.roblox_link?.url ?? existingGame?.roblox_link ?? undefined;
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
  slug = slugify(name || slug);

  console.log(`📦 Saving article for "${name}"...`);
  const insertPayload: Record<string, unknown> = {
    name,
    slug,
    intro_md: article.intro_md,
    redeem_md: article.redeem_md,
    troubleshoot_md: article.troubleshoot_md,
    rewards_md: article.rewards_md,
    description_md: null,
    seo_description: article.meta_description,
    is_published: false,
  };

  const authorId = existingGame?.author_id ?? (await pickAuthorId());
  if (authorId) {
    insertPayload.author_id = authorId;
  }

  if (robloxDenSource) insertPayload.source_url = robloxDenSource;
  if (beebomSource) insertPayload.source_url_2 = beebomSource;
  if (destructoidSource) insertPayload.source_url_3 = destructoidSource;
  if (resolvedLinks.roblox_link) insertPayload.roblox_link = resolvedLinks.roblox_link.url;
  if (resolvedLinks.community_link) insertPayload.community_link = resolvedLinks.community_link.url;
  if (resolvedLinks.discord_link) insertPayload.discord_link = resolvedLinks.discord_link.url;
  if (resolvedLinks.twitter_link) insertPayload.twitter_link = resolvedLinks.twitter_link.url;
  if (resolvedLinks.youtube_link) insertPayload.youtube_link = resolvedLinks.youtube_link.url;

  let resolvedUniverseId = (existingGame?.universe_id as number | null | undefined) ?? null;
  if (resolvedLinks.roblox_link?.url) {
    try {
      const ensuredUniverse = await ensureUniverseForRobloxLink(supabase, resolvedLinks.roblox_link.url);
      if (ensuredUniverse.universeId) {
        resolvedUniverseId = ensuredUniverse.universeId;
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to ensure Roblox universe:",
        error instanceof Error ? error.message : error
      );
    }
  }
  if (resolvedUniverseId != null) {
    insertPayload.universe_id = resolvedUniverseId;
  }

  insertPayload.slug = slug;

  if (existingGame?.id) {
    insertPayload.id = existingGame.id;
  }

  const upsert = await supabase
    .from("games")
    .upsert(insertPayload, { onConflict: existingGame?.id ? "id" : "slug" })
    .select("id")
    .maybeSingle();

  if (upsert.error) throw upsert.error;
  const gameId = upsert.data?.id ?? existingGame?.id;
  console.log(`✅ "${name}" saved successfully (${slug})`);

  if (gameId) {
    const interlinking = await generateInterlinkingForGame({
      gameId,
      gameName: name,
      gameSlug: slug,
      universeId: resolvedUniverseId ?? null
    });

    if (interlinking) {
      const { error: interlinkError } = await supabase
        .from("games")
        .update({
          interlinking_ai: interlinking.meta,
          interlinking_ai_copy_md: interlinking.copy
        })
        .eq("id", gameId);
      if (interlinkError) {
        console.warn("⚠️ Failed to store interlinking copy:", interlinkError.message);
      }

      for (const inc of interlinking.increments) {
        const { error: incError } = await supabase
          .from("games")
          .update({ internal_links: inc.internal_links })
          .eq("id", inc.id);
        if (incError) {
          console.warn(`⚠️ Failed to bump internal_links for ${inc.id}:`, incError.message);
        }
      }
    }
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
    .select("id, slug, source_url, source_url_2, source_url_3, expired_codes")
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

  const sourceUrls = [gameRecord.source_url, gameRecord.source_url_2, gameRecord.source_url_3]
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0);

  if (!sourceUrls.length) {
    console.log("⚠️ No source URLs available; skipping code sync.");
    return;
  }

  const { codes, expiredCodes } = await scrapeSources(sourceUrls);
  const scrapedExpired = expiredCodes ?? [];

  const expiredByNormalized = new Map<string, { display: string; priority: number }>();
  const setExpired = (normalized: string, display: string, priority: number) => {
    const existing = expiredByNormalized.get(normalized);
    if (!existing || priority > existing.priority) {
      expiredByNormalized.set(normalized, { display, priority });
    }
  };

  const existingExpiredArray = Array.isArray(gameRecord.expired_codes) ? gameRecord.expired_codes : [];
  for (const code of existingExpiredArray) {
    const displayCode = sanitizeCodeDisplay(code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (normalized) {
      setExpired(normalized, displayCode, -1);
    }
  }

  for (const raw of scrapedExpired) {
    const displayCode = sanitizeCodeDisplay(typeof raw === "string" ? raw : raw?.code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;
    const provider = typeof raw === "string" ? undefined : raw?.provider;
    const priority = getCodeDisplayPriority(provider);
    setExpired(normalized, displayCode, priority);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("codes")
    .select("code, status, provider_priority")
    .eq("game_id", gameRecord.id);

  if (existingError) {
    console.error(`⚠️ Failed to load existing codes for ${slug}: ${existingError.message}`);
    return;
  }

  const existingNormalizedMap = new Map<string, { code: string; providerPriority: number }>();
  for (const row of existingRows ?? []) {
    const existingCode = sanitizeCodeDisplay(row.code);
    if (!existingCode) continue;
    const normalized = normalizeCodeKey(existingCode);
    if (!normalized) continue;
    const providerPriority = Number(row.provider_priority ?? 0);
    if (existingNormalizedMap.has(normalized)) {
      const current = existingNormalizedMap.get(normalized)!;
      if (current.providerPriority >= providerPriority) {
        continue;
      }
    }
    existingNormalizedMap.set(normalized, { code: existingCode, providerPriority });
  }

  let upserted = 0;
  let newCodesCount = 0;

  for (const c of codes) {
    const displayCode = sanitizeCodeDisplay(c.code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;
    if (expiredByNormalized.has(normalized)) continue;
    const providerPriority = Number(c.providerPriority ?? 0);

    const existingEntry = existingNormalizedMap.get(normalized);
    if (existingEntry) {
      if (
        existingEntry.providerPriority > providerPriority ||
        (existingEntry.providerPriority === providerPriority && existingEntry.code === displayCode)
      ) {
        continue;
      }
    }

    if (c.isNew) {
      newCodesCount += 1;
    }

    const status = c.status === "check" ? "expired" : c.status;
    const { error } = await supabase.rpc("upsert_code", {
      p_game_id: gameRecord.id,
      p_code: displayCode,
      p_status: status,
      p_rewards_text: c.rewardsText ?? null,
      p_level_requirement: c.levelRequirement ?? null,
      p_is_new: c.isNew ?? false,
      p_provider_priority: providerPriority,
    });

    if (error) {
      console.error(`⚠️ Upsert failed for ${displayCode}: ${error.message}`);
      continue;
    }

    upserted += 1;
    existingNormalizedMap.set(normalized, { code: displayCode, providerPriority });
  }

  const removedNote = scrapedExpired.length ? `, scraped expired ${scrapedExpired.length}` : "";
  console.log(
    `✔ ${slug} — ${upserted} codes upserted (new ${newCodesCount}${removedNote})`
  );
}

function applyLinkPlaceholders(article: ArticleResponse, gameName: string, links: PlaceholderLinks): ProcessedArticle {
  const displayName = sanitizeGameDisplayName(article.game_display_name, gameName);
  let intro = article.intro_md;
  let redeem = links.roblox_link ? ensureLaunchPlaceholder(article.redeem_md, displayName) : article.redeem_md;
  let troubleshoot = article.troubleshoot_md;
  let rewards = article.rewards_md;
  const metaDescription = formatMetaDescription(article.meta_description, displayName);

  const hasPlaceholder = (key: keyof PlaceholderLinks) => {
    const token = new RegExp(`\\[\\[${key}\\|`, "i");
    return token.test(intro) || token.test(redeem) || token.test(troubleshoot) || token.test(rewards);
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
    const escaped = escapeRegExp(keyword);
    const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
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

    const fields = [
      { get: () => redeem, set: (val: string) => (redeem = val) }
    ];

    for (const regex of regexes) {
      for (const field of fields) {
        const result = wrapWithRegex(field.get(), regex, key, label);
        if (result.applied) {
          field.set(result.value);
          return;
        }
      }
    }

    for (const keyword of keywordPool) {
      for (const field of fields) {
        const result = wrapWithKeyword(field.get(), keyword, key, label);
        if (result.applied) {
          field.set(result.value);
          return;
        }
      }
    }

    redeem = appendSentence(redeem, buildFallback(label));
  };

  ensurePlaceholder(
    "roblox_link",
    [displayName],
    [],
    (label) => `Visit [[roblox_link|${label}]] to hop in and start playing.`
  );
  // Only the Roblox launch placeholder is required; all other placeholders should be stripped
  const stripNonRobloxPlaceholders = (value: string): string =>
    value.replace(/\[\[(?!roblox_link)[a-z0-9_]+\|([^\]]+)\]\]/gi, "$1");

  intro = stripNonRobloxPlaceholders(intro);
  redeem = stripNonRobloxPlaceholders(redeem);
  troubleshoot = stripNonRobloxPlaceholders(troubleshoot);
  rewards = stripNonRobloxPlaceholders(rewards);

  return {
    intro_md: intro,
    redeem_md: redeem,
    troubleshoot_md: troubleshoot,
    rewards_md: rewards,
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
