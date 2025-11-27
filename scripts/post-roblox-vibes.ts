import "dotenv/config";

import crypto from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

const LOOKBACK_HOURS = Number(process.env.ROBLOX_VIBES_LOOKBACK_HOURS ?? "6");
const MIN_PLAYING = Number(process.env.ROBLOX_VIBES_MIN_PLAYING ?? "200");

const TRENDING_SORT_IDS = [
  "trending-in-rpg",
  "trending-music-experiences",
  "most-popular",
  "trending-in-sports-and-racing",
  "trending-in-shooter",
  "trending-in-action",
  "trending-in-adventure",
  "trending-in-entertainment",
  "trending-in-obby-and-platformer",
  "trending-in-party-and-casual",
  "trending-in-puzzle",
  "trending-in-roleplay-and-avatar-sim",
  "trending-in-shopping",
  "trending-in-simulation",
  "trending-in-strategy",
  "trending-in-survival",
  "top-earning",
  "top-rated",
  "top-paid-access"
];

type SocialLinks = Record<string, unknown> | null;

type Universe = {
  universe_id: number | null;
  name: string | null;
  display_name: string | null;
  slug: string | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  genre: string | null;
  social_links: SocialLinks;
};

type UniverseWithId = Universe & { universe_id: number };

type SortEntry = {
  sort_id: string;
  rank: number | null;
  fetched_at: string;
  universe: Universe | null;
};

type SortEntryQuery = Omit<SortEntry, "universe"> & {
  universe: Universe | Universe[] | null;
};

type Candidate = {
  sortId: string;
  rank: number;
  fetchedAt: string;
  universe: UniverseWithId;
};

type PlatformResult = "sent" | "skipped";

function formatNumber(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 10_000) return `${Math.round(value / 100) / 10}K`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function pick<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function sanitizeTag(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return null;
  return `#${cleaned.slice(0, 30)}`;
}

function extractHandleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})/i);
  if (!match) return null;
  return `@${match[1]}`;
}

function extractHandleFromSocialLinks(social: SocialLinks): string | null {
  if (!social || typeof social !== "object") return null;
  const possibleKeys = ["twitter", "x", "twitter_link", "x_link"];
  for (const key of possibleKeys) {
    const value = (social as Record<string, unknown>)[key];
    if (typeof value === "string") {
      const handle = extractHandleFromUrl(value);
      if (handle) return handle;
    }
  }
  for (const value of Object.values(social)) {
    if (typeof value === "string") {
      const handle = extractHandleFromUrl(value);
      if (handle) return handle;
    }
  }
  return null;
}

async function fetchUniverseHandle(universeId: number): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_social_links")
    .select("platform, url")
    .eq("universe_id", universeId)
    .ilike("platform", "twitter%")
    .order("fetched_at", { ascending: false })
    .limit(3);

  if (error) {
    console.warn(`⚠️ Unable to load social links for ${universeId}: ${error.message}`);
    return null;
  }
  for (const row of data ?? []) {
    const handle = extractHandleFromUrl((row as { url?: string }).url);
    if (handle) return handle;
  }
  return null;
}

async function fetchTrending(): Promise<Candidate[]> {
  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universe_sort_entries")
    .select("sort_id, rank, fetched_at, universe:roblox_universes(universe_id,name,display_name,slug,playing,visits,favorites,likes,dislikes,genre,social_links)")
    .in("sort_id", TRENDING_SORT_IDS)
    .gte("fetched_at", sinceIso)
    .order("rank", { ascending: true })
    .limit(200);

  if (error) {
    console.warn("⚠️ Unable to load trending universes:", error.message);
    return [];
  }

  const byUniverse = new Map<number, Candidate>();
  const entries = ((data ?? []) as SortEntryQuery[]).map(normalizeSortEntry);
  for (const entry of entries) {
    const universe = entry.universe;
    if (!universe || typeof universe.universe_id !== "number") continue;
    const universeWithId: UniverseWithId = { ...universe, universe_id: universe.universe_id };
    const rank = typeof entry.rank === "number" ? entry.rank : 999;
    const playing = universe.playing ?? null;
    if (playing !== null && playing < MIN_PLAYING) continue;
    const existing = byUniverse.get(universe.universe_id);
    if (!existing || rank < existing.rank) {
      byUniverse.set(universe.universe_id, {
        sortId: entry.sort_id,
        rank,
        fetchedAt: entry.fetched_at,
        universe: universeWithId
      });
    }
  }

  return Array.from(byUniverse.values()).sort((a, b) => a.rank - b.rank);
}

function formatStat(universe: Universe): string {
  const playing = formatNumber(universe.playing);
  const visits = formatNumber(universe.visits);
  const likes = formatNumber(universe.likes);
  if (playing) return `${playing} playing`;
  if (visits) return `${visits} visits`;
  if (likes) return `${likes} likes`;
  return "getting buzz";
}

const TREND_TEMPLATES = [
  "[game] is popping off rn ([stat]). Who's hopping in with me?",
  "Spotted [game] climbing my Roblox feed – [stat] and rising. Worth a try?",
  "Dropping into [game] because it's trending hard. [stat] squad energy!",
  "Roblox wander mode: checking out [game] today. [stat] already grinding, let's go!",
  "Anyone else seeing [game] everywhere? [stat] live. Need teammates!",
  "Trying [game] tonight – vibes look fun and [stat]. Send tips?",
  "Queueing up [game]; [stat] tells me it's the move. Who's in?"
];

const FALLBACK_PROMPTS = [
  "What's the most chaotic Roblox lobby you've ever survived? Asking for \"research\".",
  "Dropped into a random obby and immediately faceplanted. What are you playing tonight?",
  "Roblox question of the day: build, grind, or pure chaos? Pick your mood.",
  "If you could mash two Roblox games together, which ones are you fusing?",
  "Need new recs: chill hangout game vs sweaty tryhard game. Hit me.",
  "First Roblox game you ever loved – go!",
  "Who else hoards avatar items they never use? 👀",
  "Speedrunning snack break before queuing up again. What should I play?"
];

const normalizeSortEntry = (entry: SortEntryQuery): SortEntry => ({
  ...entry,
  universe: Array.isArray(entry.universe) ? entry.universe[0] ?? null : entry.universe ?? null
});

function pickTags(gameName: string | null | undefined): string {
  const tags: string[] = [];
  if (Math.random() < 0.55) {
    tags.push("#Roblox");
  }
  const gameTag = sanitizeTag(gameName);
  if (gameTag && Math.random() < 0.8) {
    tags.push(gameTag);
  }
  return tags.join(" ");
}

function buildTrendTweet(candidate: Candidate, handle: string | null): string {
  const name = candidate.universe.display_name ?? candidate.universe.name ?? "this game";
  const stat = formatStat(candidate.universe);
  const baseTemplate = pick(TREND_TEMPLATES) ?? TREND_TEMPLATES[0];
  let tweet = baseTemplate.replace("[game]", name).replace("[stat]", stat);

  const tagLine = pickTags(name);
  const devLine = handle ? `Dev: ${handle}` : "";

  const parts = [tweet];
  if (devLine) parts.push(devLine);
  if (tagLine) parts.push(tagLine);

  tweet = parts.filter(Boolean).join("\n");
  if (tweet.length > 280) {
    const trimmed = [parts[0], tagLine].filter(Boolean).join("\n");
    tweet = trimmed.length <= 280 ? trimmed : parts[0];
  }
  return tweet;
}

function buildFallbackTweet(): string {
  const prompt = pick(FALLBACK_PROMPTS) ?? FALLBACK_PROMPTS[0];
  const tags = pickTags(null);
  const tweet = tags ? `${prompt}\n${tags}` : prompt;
  return tweet.length <= 280 ? tweet : prompt.slice(0, 276) + "…";
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27");
}

async function postToTwitter(text: string): Promise<PlatformResult> {
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.log("Skipping Twitter posting (missing user-context credentials).");
    return "skipped";
  }

  const url = "https://api.twitter.com/2/tweets";
  const method = "POST";
  const payload = { text };

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: crypto.randomBytes(32).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: "1.0"
  };

  const signatureBaseString = [
    method,
    percentEncode(url),
    percentEncode(
      Object.keys(oauthParams)
        .sort()
        .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
        .join("&")
    )
  ].join("&");

  const signingKey = `${percentEncode(TWITTER_API_SECRET)}&${percentEncode(TWITTER_ACCESS_SECRET)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");

  const authorizationHeader =
    "OAuth " +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
      .join(", ");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorizationHeader
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitter API error (${response.status}): ${body}`);
  }

  return "sent";
}

async function main() {
  const candidates = await fetchTrending();
  let tweet: string;

  if (candidates.length) {
    const pickIndex = Math.min(candidates.length - 1, Math.floor(Math.random() * Math.min(5, candidates.length)));
    const selection = candidates[pickIndex];
    const guessedHandle = extractHandleFromSocialLinks(selection.universe.social_links);
    const handle = selection.universe.universe_id
      ? (await fetchUniverseHandle(selection.universe.universe_id)) ?? guessedHandle
      : guessedHandle;
    tweet = buildTrendTweet(selection, handle);
    console.log(`Selected trending universe ${selection.universe.display_name ?? selection.universe.name ?? selection.universe.universe_id}`);
  } else {
    tweet = buildFallbackTweet();
    console.log("No trending candidates found. Using fallback prompt.");
  }

  console.log("Tweet preview:\n", tweet);
  const result = await postToTwitter(tweet);
  console.log(`Twitter post ${result === "sent" ? "sent" : "skipped"}.`);
}

main().catch((err) => {
  console.error("Roblox vibes posting failed:", err);
  process.exit(1);
});
