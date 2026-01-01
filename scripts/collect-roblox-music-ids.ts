import "dotenv/config";
import { supabaseAdmin } from "@/lib/supabase";

const TOP_SONGS_API = "https://apis.roblox.com/music-discovery/v1/top-songs";
const TOP_SONGS_PAGE_LIMIT = Number(process.env.ROBLOX_TOP_SONGS_LIMIT ?? "100");
const TOP_SONGS_MAX_PAGES = Number(process.env.ROBLOX_TOP_SONGS_MAX_PAGES ?? "25");
const TOP_SONGS_DELAY_MS = Number(process.env.ROBLOX_TOP_SONGS_DELAY_MS ?? "200");
const TOP_SONGS_MAX_RETRIES = Number(process.env.ROBLOX_TOP_SONGS_MAX_RETRIES ?? "3");

const TOOLBOX_SEARCH_API = "https://apis.roblox.com/toolbox-service/v2/assets:search";
const TOOLBOX_PAGE_SIZE = Number(process.env.ROBLOX_TOOLBOX_PAGE_SIZE ?? "100");
const TOOLBOX_MAX_ASSETS = Number(process.env.ROBLOX_TOOLBOX_MAX_ASSETS ?? "0");
const TOOLBOX_MAX_PAGES = Number(process.env.ROBLOX_TOOLBOX_MAX_PAGES ?? "200");
const TOOLBOX_DELAY_MS = Number(process.env.ROBLOX_TOOLBOX_DELAY_MS ?? "200");
const TOOLBOX_MAX_RETRIES = Number(process.env.ROBLOX_TOOLBOX_MAX_RETRIES ?? "3");
const TOOLBOX_SORT_CATEGORY_RAW = process.env.ROBLOX_TOOLBOX_SORT_CATEGORY;
const TOOLBOX_SORT_DIRECTION = process.env.ROBLOX_TOOLBOX_SORT_DIRECTION ?? "Descending";
const TOOLBOX_SEARCH_VIEW = process.env.ROBLOX_TOOLBOX_SEARCH_VIEW ?? "Full";
const TOOLBOX_QUERY_SEEDS_RAW = process.env.ROBLOX_TOOLBOX_QUERY_SEEDS;
const TOOLBOX_SORT_CATEGORIES_RAW = process.env.ROBLOX_TOOLBOX_SORT_CATEGORIES;
const TOOLBOX_CHART_TYPES_RAW = process.env.ROBLOX_TOOLBOX_CHART_TYPES;
const TOOLBOX_DURATION_BUCKETS_RAW = process.env.ROBLOX_TOOLBOX_DURATION_BUCKETS;
const TOOLBOX_EMPTY_PAGE_LIMIT = Number(process.env.ROBLOX_TOOLBOX_EMPTY_PAGE_LIMIT ?? "2");
const TOOLBOX_INCLUDE_EMPTY_QUERY = process.env.ROBLOX_TOOLBOX_INCLUDE_EMPTY_QUERY;

const DEFAULT_QUERY_SEEDS = [
  "electronic",
  "ambient",
  "pop",
  "hip hop",
  "indie",
  "funk",
  "rock",
  "lofi",
  "jazz",
  "acoustic",
  "country",
  "metal",
  "r&b",
  "rap",
  "folk",
  "holiday",
  "classical",
  "world"
];
const DEFAULT_SORT_CATEGORIES = ["Top", "Trending", "Ratings", "UpdatedTime", "CreateTime"];
const DEFAULT_CHART_TYPES = ["None", "Current", "Week", "Month", "Year"];
const DEFAULT_DURATION_BUCKETS = ["any", "0-60", "61-180", "181-600", "601-1800", "1801-"];

type RobloxTopSong = {
  assetId?: number;
  album?: string;
  artist?: string;
  duration?: number;
  title?: string;
  albumArtAssetId?: number;
};

type RobloxTopSongsResponse = {
  songs?: RobloxTopSong[];
  nextPageToken?: string | null;
};

type ToolboxAsset = {
  id?: number;
  name?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  artist?: string | null;
  title?: string | null;
  album?: string | null;
  genre?: string | null;
  previewAssets?: {
    imagePreviewAssets?: number[] | null;
    videoPreviewAssets?: number[] | null;
  } | null;
};

type VotingDetails = {
  voteCount?: number | null;
  upVotePercent?: number | null;
};

type CreatorStoreAsset = {
  asset?: ToolboxAsset | null;
  creator?: { id?: number; name?: string | null; creatorType?: string; verified?: boolean | null } | null;
  creatorStoreProduct?: Record<string, unknown> | null;
  voting?: VotingDetails | null;
};

type ToolboxSearchResponse = {
  creatorStoreAssets?: CreatorStoreAsset[] | null;
  nextPageToken?: string | null;
  totalResults?: number;
};

type DurationBucket = {
  min: number | null;
  max: number | null;
  label: string;
};

type ToolboxSearchConfig = {
  query: string | null;
  sortCategory: string;
  sortDirection: string;
  chartType: string;
  duration: DurationBucket;
};

type MusicRow = {
  asset_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  rank: number | null;
  source: string;
  vote_count?: number | null;
  upvote_percent?: number | null;
  creator_verified?: boolean | null;
  raw_payload: Record<string, unknown>;
  last_seen_at: string;
};

function clampTopSongsLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  return Math.max(1, Math.floor(value));
}

function clampToolboxLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function normalizeSeed(seed: string): string {
  return seed.trim().replace(/\s+/g, " ");
}

function expandQuerySeeds(seeds: string[]): string[] {
  const unique = new Map<string, string>();
  const addSeed = (value: string) => {
    const cleaned = normalizeSeed(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  };

  seeds.forEach((seed) => addSeed(seed));
  seeds.forEach((seed) => addSeed(`${seed} music`));
  return Array.from(unique.values());
}

function parseQuerySeeds(raw?: string): string[] {
  const base = raw && raw.trim()
    ? raw.split(",").map((seed) => seed.trim()).filter((seed) => seed.length > 0)
    : DEFAULT_QUERY_SEEDS;
  return expandQuerySeeds(base);
}

function parseDurationBuckets(raw?: string): DurationBucket[] {
  const seeds = parseCsv(raw, DEFAULT_DURATION_BUCKETS);
  const buckets: DurationBucket[] = [];
  for (const token of seeds) {
    const value = token.trim().toLowerCase();
    if (value === "any" || value === "all") {
      buckets.push({ min: null, max: null, label: "any" });
      continue;
    }
    const [rawMin, rawMax] = value.split("-");
    const min = rawMin ? Number(rawMin) : null;
    const max = rawMax ? Number(rawMax) : null;
    if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))) {
      continue;
    }
    const label = `${min ?? ""}-${max ?? ""}`.replace(/^-$/, "any");
    buckets.push({ min: min ?? null, max: max ?? null, label });
  }
  return buckets.length ? buckets : [{ min: null, max: null, label: "any" }];
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRequiredText(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTopSongsPage(pageToken: string, limit: number): Promise<RobloxTopSongsResponse> {
  const params = new URLSearchParams({
    pageToken,
    limit: String(clampTopSongsLimit(limit))
  });
  const url = `${TOP_SONGS_API}?${params.toString()}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "BloxodesBot/1.0"
      }
    });

    if (res.ok) {
      return (await res.json()) as RobloxTopSongsResponse;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= TOP_SONGS_MAX_RETRIES) {
      const body = await res.text().catch(() => "");
      throw new Error(`Top songs fetch failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const backoff = 300 * Math.pow(2, attempt);
    attempt += 1;
    await sleep(backoff);
  }
}

async function fetchToolboxMusicPage(
  pageToken: string | null,
  config: ToolboxSearchConfig
): Promise<ToolboxSearchResponse> {
  const params = new URLSearchParams({
    searchCategoryType: "Audio",
    maxPageSize: String(clampToolboxLimit(TOOLBOX_PAGE_SIZE)),
    searchView: TOOLBOX_SEARCH_VIEW,
    sortCategory: config.sortCategory,
    sortDirection: config.sortDirection,
    includeOnlyVerifiedCreators: "false"
  });
  params.append("audioTypes", "Music");
  if (config.query) {
    params.set("query", config.query);
  }
  if (config.duration.min !== null) {
    params.set("audioMinDurationSeconds", String(config.duration.min));
  }
  if (config.duration.max !== null) {
    params.set("audioMaxDurationSeconds", String(config.duration.max));
  }
  if (config.chartType && config.chartType !== "None") {
    params.set("includeTopCharts", "true");
    params.set("musicChartType", config.chartType);
  }
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const url = `${TOOLBOX_SEARCH_API}?${params.toString()}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "BloxodesBot/1.0"
      }
    });

    if (res.ok) {
      return (await res.json()) as ToolboxSearchResponse;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= TOOLBOX_MAX_RETRIES) {
      const body = await res.text().catch(() => "");
      throw new Error(`Toolbox search failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const backoff = 300 * Math.pow(2, attempt);
    attempt += 1;
    await sleep(backoff);
  }
}

async function upsertRows(rows: MusicRow[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from("roblox_music_ids").upsert(chunk, { onConflict: "asset_id" });
    if (error) {
      throw new Error(`Failed to upsert music IDs: ${error.message}`);
    }
  }
}

function buildTopSongRows(songs: RobloxTopSong[], fetchedAt: string, rankOffset: number): MusicRow[] {
  const rows: MusicRow[] = [];
  songs.forEach((song, index) => {
    if (typeof song.assetId !== "number") return;
    rows.push({
      asset_id: song.assetId,
      title: normalizeRequiredText(song.title, "Unknown Title"),
      artist: normalizeRequiredText(song.artist, "Unknown Artist"),
      album: normalizeOptionalText(song.album),
      genre: null,
      duration_seconds: typeof song.duration === "number" ? song.duration : null,
      album_art_asset_id: typeof song.albumArtAssetId === "number" ? song.albumArtAssetId : null,
      rank: rankOffset + index + 1,
      source: "music_discovery_top_songs",
      raw_payload: song as Record<string, unknown>,
      last_seen_at: fetchedAt
    });
  });
  return rows;
}

function buildToolboxRows(assets: CreatorStoreAsset[], fetchedAt: string): MusicRow[] {
  const rows: MusicRow[] = [];
  assets.forEach((entry) => {
    const asset = entry.asset ?? null;
    if (!asset || typeof asset.id !== "number") return;
    const previewId = asset.previewAssets?.imagePreviewAssets?.[0] ?? null;
    const voteCount = typeof entry.voting?.voteCount === "number" ? entry.voting.voteCount : null;
    const upvotePercent = typeof entry.voting?.upVotePercent === "number" ? entry.voting.upVotePercent : null;
    const creatorVerified = typeof entry.creator?.verified === "boolean" ? entry.creator.verified : null;
    rows.push({
      asset_id: asset.id,
      title: normalizeRequiredText(asset.title ?? asset.name ?? undefined, "Unknown Title"),
      artist: normalizeRequiredText(asset.artist ?? undefined, "Unknown Artist"),
      album: normalizeOptionalText(asset.album ?? null),
      genre: normalizeOptionalText(asset.genre ?? null),
      duration_seconds: typeof asset.durationSeconds === "number" ? asset.durationSeconds : null,
      album_art_asset_id: typeof previewId === "number" ? previewId : null,
      rank: null,
      source: "toolbox_music_search",
      vote_count: voteCount,
      upvote_percent: upvotePercent,
      creator_verified: creatorVerified,
      raw_payload: entry as Record<string, unknown>,
      last_seen_at: fetchedAt
    });
  });
  return rows;
}

async function collectToolboxMusic(): Promise<number> {
  const maxAssets = TOOLBOX_MAX_ASSETS > 0 ? TOOLBOX_MAX_ASSETS : Number.POSITIVE_INFINITY;
  const fetchedAt = new Date().toISOString();
  const querySeeds = parseQuerySeeds(TOOLBOX_QUERY_SEEDS_RAW);
  if (toBoolean(TOOLBOX_INCLUDE_EMPTY_QUERY, false) && !querySeeds.includes("")) {
    querySeeds.unshift("");
  }
  const sortCategories = parseCsv(TOOLBOX_SORT_CATEGORIES_RAW ?? TOOLBOX_SORT_CATEGORY_RAW, DEFAULT_SORT_CATEGORIES);
  const chartTypes = parseCsv(TOOLBOX_CHART_TYPES_RAW, DEFAULT_CHART_TYPES);
  const durationBuckets = parseDurationBuckets(TOOLBOX_DURATION_BUCKETS_RAW);
  const seenAssetIds = new Set<number>();
  let totalUpserts = 0;
  let totalQueries = 0;

  console.log(
    `Toolbox music search starting (${querySeeds.length} queries, max ${Number.isFinite(maxAssets) ? maxAssets : "unlimited"} assets)...`
  );

  for (const chartType of chartTypes) {
    for (const sortCategory of sortCategories) {
      for (const duration of durationBuckets) {
        for (const query of querySeeds) {
          if (!query.length && chartType === "None") continue;
          if (totalUpserts >= maxAssets) break;
          totalQueries += 1;

          const seenTokens = new Set<string>();
          let pageToken: string | null = null;
          let pageCount = 0;
          let emptyPages = 0;
          const queryLabel = query.length ? query : "(empty)";
          const labelParts = [
            `query="${queryLabel}"`,
            `sort=${sortCategory}/${TOOLBOX_SORT_DIRECTION}`,
            `chart=${chartType}`,
            `duration=${duration.label}`
          ];
          console.log(`Toolbox search ${labelParts.join(" · ")}...`);

          const config: ToolboxSearchConfig = {
            query: query.length ? query : null,
            sortCategory,
            sortDirection: TOOLBOX_SORT_DIRECTION,
            chartType,
            duration
          };

          while (pageCount < TOOLBOX_MAX_PAGES && totalUpserts < maxAssets) {
            if (pageToken && seenTokens.has(pageToken)) {
              console.log(`Stopping toolbox: pageToken ${pageToken} repeated.`);
              break;
            }
            if (pageToken) {
              seenTokens.add(pageToken);
            }

            const payload = await fetchToolboxMusicPage(pageToken, config);
            const assets = Array.isArray(payload.creatorStoreAssets) ? payload.creatorStoreAssets : [];
            if (!assets.length) {
              console.log(`No toolbox assets returned for ${queryLabel}.`);
              break;
            }

            const rows = buildToolboxRows(assets, fetchedAt);
            const uniqueRows = rows.filter((row) => {
              if (seenAssetIds.has(row.asset_id)) return false;
              seenAssetIds.add(row.asset_id);
              return true;
            });

            const remaining = maxAssets - totalUpserts;
            const slice = remaining < uniqueRows.length ? uniqueRows.slice(0, remaining) : uniqueRows;
            if (slice.length) {
              await upsertRows(slice);
              totalUpserts += slice.length;
              emptyPages = 0;
            } else {
              emptyPages += 1;
              if (emptyPages >= TOOLBOX_EMPTY_PAGE_LIMIT) {
                console.log(`Stopping toolbox: no new items for ${emptyPages} pages.`);
                break;
              }
            }

            pageCount += 1;
            const nextToken =
              typeof payload.nextPageToken === "string" && payload.nextPageToken.trim().length
                ? payload.nextPageToken.trim()
                : null;
            pageToken = nextToken;

            if (!pageToken) break;
            await sleep(TOOLBOX_DELAY_MS);
          }
        }
      }
    }
  }

  console.log(`Upserted ${totalUpserts} toolbox music assets across ${totalQueries} queries.`);
  return totalUpserts;
}

async function collectTopSongs(): Promise<number> {
  const fetchedAt = new Date().toISOString();
  const topSongsLimit = clampTopSongsLimit(TOP_SONGS_PAGE_LIMIT);
  const seenTokens = new Set<string>();
  let pageToken: string | null = "0";
  let rankOffset = 0;
  let totalUpserts = 0;
  let pageCount = 0;

  console.log(`Top songs limit set to ${topSongsLimit}.`);
  while (pageToken && pageCount < TOP_SONGS_MAX_PAGES) {
    if (seenTokens.has(pageToken)) {
      console.log(`Stopping top songs: pageToken ${pageToken} repeated.`);
      break;
    }
    seenTokens.add(pageToken);

    const payload = await fetchTopSongsPage(pageToken, topSongsLimit);
    const songs = Array.isArray(payload.songs) ? payload.songs : [];
    if (!songs.length) {
      console.log("No top songs returned; stopping.");
      break;
    }

    const rows = buildTopSongRows(songs, fetchedAt, rankOffset);
    await upsertRows(rows);
    totalUpserts += rows.length;
    rankOffset += songs.length;
    pageCount += 1;

    const nextToken =
      typeof payload.nextPageToken === "string" && payload.nextPageToken.trim().length
        ? payload.nextPageToken.trim()
        : null;
    pageToken = nextToken;

    if (pageToken) {
      await sleep(TOP_SONGS_DELAY_MS);
    }
  }

  console.log(`Upserted ${totalUpserts} top songs.`);
  return totalUpserts;
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const toolboxCount = await collectToolboxMusic();
  const topSongsCount = await collectTopSongs();
  console.log(`Done. Toolbox: ${toolboxCount}. Top songs: ${topSongsCount}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
