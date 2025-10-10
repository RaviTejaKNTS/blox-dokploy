import "dotenv/config";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import sharp from "sharp";

import { refreshGameCodesWithSupabase } from "@/lib/admin/game-refresh";
import { getSupabaseConfig } from "@/lib/supabase-config";
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
};

type ProcessedArticle = ArticleResponse;

type SocialLinks = {
  roblox_link?: string;
  community_link?: string;
  discord_link?: string;
  twitter_link?: string;
};

function isArticleResponse(value: unknown): value is ArticleResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["intro_md", "redeem_md", "description_md"].every(
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

function isTwitterProfile(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (!host.includes("twitter.com") && !host.includes("x.com")) return false;
  if (path.startsWith("/intent") || path.startsWith("/share") || path.includes("/intent/")) return false;
  const handle = path.split("/").filter(Boolean)[0] ?? "";
  if (["beebomco", "beebom"].includes(handle)) return false;
  return path.split("/").filter(Boolean).length >= 1;
}

async function extractSocialLinksFromBeebom(url: string): Promise<SocialLinks> {
  const result: SocialLinks = {};

  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const anchors = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]"));

    for (const anchor of anchors) {
      const resolved = resolveHref(anchor.getAttribute("href"), url);
      const normalized = normalizeExternalLink(resolved);
      if (!normalized) continue;

      if (!result.roblox_link && /roblox\.com\/games\//i.test(normalized)) {
        result.roblox_link = normalized;
        continue;
      }

      if (!result.community_link && /roblox\.com\/communities\//i.test(normalized)) {
        result.community_link = normalized;
        continue;
      }

      if (!result.discord_link && /(discord\.gg|discord\.com)/i.test(normalized)) {
        result.discord_link = normalized;
        continue;
      }

      if (!result.twitter_link) {
        try {
          const parsed = new URL(normalized);
          if (isTwitterProfile(parsed)) {
            result.twitter_link = parsed.toString();
          }
        } catch {
          /* ignore */
        }
      }

      if (result.roblox_link && result.community_link && result.discord_link && result.twitter_link) {
        break;
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to extract social links from Beebom:", error instanceof Error ? error.message : error);
  }

  return result;
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

function buildArticlePrompt(gameName: string, sources: string) {
  return `
You are a professional Roblox journalist.
Use ONLY the information from these trusted sources below to write an accurate, detailed, and structured article.
Do NOT invent or guess anything. If something isn't in the sources, skip it.

Use the link placeholders below instead of raw URLs. Always wrap the exact anchor text in the placeholder format [[placeholder_key|Anchor Text]] and never output the actual URL.
- [[roblox_link|...]] → official Roblox experience page
- [[community_link|...]] → community links players should join or follow
- [[discord_link|...]] → Discord server or channel names
- [[twitter_link|...]] → Twitter/X handles or profiles
- [[youtube_link|...]] → YouTube channels
If a source does not mention a specific destination, simply skip the placeholder for that item.

=== SOURCES START ===
${sources}
=== SOURCES END ===

Write in clean markdown, no em-dashes, no speculation. The entire article should be between 600–800 words long in average. Keep the language simple, full sentences and like friend talking to another friend. When you need a link, use the placeholders above.

Sections required:
1. intro_md – 1–2 paragraphs. Start with something that hook the readers in simple on-point and grounded way. Introduce the ${gameName} in a line or two and tell users how these codes can be helpful in engaging, relatable, crisp and on-point way. Keep it grounded and talk like friend explaining things to a friend.
2. redeem_md – "## How to Redeem ${gameName} Codes" with numbered steps.
   - If any requirements, conditions, or level limits appear anywhere in the sources, summarize them clearly before listing steps.
   - If there are no requirements, write a line or teo before the steps, to give cue to the actual steps. 
   - Write step-by-step in numbered list and keep the sentences simple and easy to scan. Do not use : and write like key value pairs, just write simple sentences.
   - Always wrap the instruction to start the experience with [[roblox_link|Launch ${gameName}]].
   - When you ask readers to join or follow a community, wrap the relevant words with [[community_link|...]].
   - If the game does not have codes system yet, no need for step-by-step instructions, just convey the information in clear detail. 
3. description_md – include all these sections:
   - ## Why Is My ${gameName} Code Not Working?
     Bullet list of real reasons from sources. Be very detailed and include all the reasons for why any code could fail. Before the bullet points, write at least a line or two to give cue to the actual points.
     Also, after the points have mentioned, write a line or two to talk to the user to give more context about this if you have or skip.
   - ## Where to Find More ${gameName} Codes
     1–2 paragraphs. Use the sources to locate the official Roblox page plus any verified social channels (Discord, Twitter/X, Trello, Roblox Group, etc.).
     Mention each channel by exact name (Discord server title, channel names, Twitter @handle, Roblox group title, etc.) and explain what players can find there.
     Wrap Roblox mentions with [[roblox_link|...]], Discord mentions with [[discord_link|...]], Twitter/X mentions with [[twitter_link|...]], community links with [[community_link|...]], and YouTube mentions with [[youtube_link|...]]. Make sure the anchor text is the real channel or profile name (e.g. [[discord_link|Tower Defense Discord]]).
     If a source clearly references a Discord, Twitter/X, or community link, you must include the corresponding placeholder in this section. If the source does not mention that channel, do not invent it.
     no bullet-points in this section at all. Just conversational paras
     Also suggest users to bookmark our page with ctrl + D on Windows (CMD + D on mac). Tell them that we will update the article with new working active codes as soon as they dropped.
   - ## What Rewards You Normally Get?
     Bullet list or table of typical rewards (from the sources). Include all the reward types we get for this game with clear details, description of each reward, and all the info that makes sense to include in this section. The section should be detailed, in-depth, and everything should be cleanly explained. Write at least a line or two before jumping into the points or table to give cue to the audience.
   - ## How to Play ${gameName} and What It's All About
     200–300 words explaining the game and how codes benefit players. Talk like a friend explaining the game to another friend and explain everything like a story.

Return valid JSON:
{
  "intro_md": "...",
  "redeem_md": "...",
  "description_md": "..."
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

  const [robloxDenSource, beebomSource] = await Promise.all([
    findGameCodeArticle(gameName, "robloxden.com/game-codes"),
    findGameCodeArticle(gameName, "beebom.com"),
  ]);

  let socialLinks: SocialLinks = {};
  if (beebomSource) {
    socialLinks = await extractSocialLinksFromBeebom(beebomSource);
  }

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

  const article = applyLinkPlaceholders(parsed, gameName);

  const name = gameName.trim();
  const slug = normalizeGameSlug(gameName, gameName);

  const { data: existingGame, error: existingError } = await supabase
    .from("games")
    .select("id, is_published, roblox_link, community_link, discord_link, twitter_link, source_url")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingGame?.is_published) {
    console.log(`ℹ️ "${name}" already exists and is published. Skipping generation.`);
    return;
  }

  console.log(`📦 Saving article for "${name}"...`);
  const insertPayload: Record<string, unknown> = {
    name,
    slug,
    intro_md: article.intro_md,
    redeem_md: article.redeem_md,
    description_md: article.description_md,
    is_published: true,
  };

  if (robloxDenSource) insertPayload.source_url = robloxDenSource;
  if (beebomSource) insertPayload.source_url_2 = beebomSource;
  if (socialLinks.roblox_link) insertPayload.roblox_link = socialLinks.roblox_link;
  if (socialLinks.community_link) insertPayload.community_link = socialLinks.community_link;
  if (socialLinks.discord_link) insertPayload.discord_link = socialLinks.discord_link;
  if (socialLinks.twitter_link) insertPayload.twitter_link = socialLinks.twitter_link;

  const upsert = await supabase
    .from("games")
    .upsert(insertPayload, { onConflict: "slug" })
    .select("id")
    .maybeSingle();

  if (upsert.error) throw upsert.error;
  const gameId = upsert.data?.id ?? existingGame?.id;
  console.log(`✅ "${name}" saved successfully (${slug})`);

  const coverSourceLink = socialLinks.roblox_link ?? existingGame?.roblox_link ?? existingGame?.source_url ?? null;
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

function applyLinkPlaceholders(article: ArticleResponse, gameName: string): ProcessedArticle {
  return {
    intro_md: article.intro_md,
    redeem_md: ensureLaunchPlaceholder(article.redeem_md, gameName),
    description_md: article.description_md,
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
  const { supabaseUrl } = getSupabaseConfig();
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
