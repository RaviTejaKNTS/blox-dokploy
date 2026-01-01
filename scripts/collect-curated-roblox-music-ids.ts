import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";

const TOP_SONGS_API = "https://apis.roblox.com/music-discovery/v1/top-songs";
const TOOLBOX_SEARCH_API = "https://apis.roblox.com/toolbox-service/v2/assets:search";

const USER_AGENT = "BloxodesCuratedMusicBot/1.0";

const MAX_ASSETS = clampNumber(process.env.ROBLOX_CURATED_MAX_ASSETS, 5000, 0, Number.POSITIVE_INFINITY);

const TOP_SONGS_PAGE_LIMIT = clampNumber(process.env.ROBLOX_CURATED_TOP_SONGS_LIMIT, 100, 1, 100);
const TOP_SONGS_MAX_PAGES = clampNumber(process.env.ROBLOX_CURATED_TOP_SONGS_MAX_PAGES, 5, 1, 50);
const TOP_SONGS_DELAY_MS = clampNumber(process.env.ROBLOX_CURATED_TOP_SONGS_DELAY_MS, 200, 0, 10000);
const TOP_SONGS_MAX_RETRIES = clampNumber(process.env.ROBLOX_CURATED_TOP_SONGS_MAX_RETRIES, 3, 0, 10);

const TOOLBOX_PAGE_SIZE = clampNumber(process.env.ROBLOX_CURATED_TOOLBOX_PAGE_SIZE, 100, 1, 100);
const TOOLBOX_MAX_PAGES = clampNumber(process.env.ROBLOX_CURATED_TOOLBOX_MAX_PAGES, 5, 1, 50);
const TOOLBOX_SORT_CATEGORY = process.env.ROBLOX_CURATED_TOOLBOX_SORT_CATEGORY ?? "Top";
const TOOLBOX_SORT_DIRECTION = process.env.ROBLOX_CURATED_TOOLBOX_SORT_DIRECTION ?? "Descending";
const TOOLBOX_SEARCH_VIEW = process.env.ROBLOX_CURATED_TOOLBOX_SEARCH_VIEW ?? "Full";
const TOOLBOX_CHART_TYPES = parseCsv(process.env.ROBLOX_CURATED_TOOLBOX_CHART_TYPES, ["Current", "Week", "Month", "Year"]);
const TOOLBOX_INCLUDE_TRENDING = toBoolean(process.env.ROBLOX_CURATED_TOOLBOX_INCLUDE_TRENDING, true);
const TOOLBOX_TRENDING_PAGES = clampNumber(process.env.ROBLOX_CURATED_TOOLBOX_TRENDING_PAGES, 3, 1, 50);
const TOOLBOX_DELAY_MS = clampNumber(process.env.ROBLOX_CURATED_TOOLBOX_DELAY_MS, 200, 0, 10000);
const TOOLBOX_MAX_RETRIES = clampNumber(process.env.ROBLOX_CURATED_TOOLBOX_MAX_RETRIES, 3, 0, 10);

const UPSERT_CHUNK_SIZE = clampNumber(process.env.ROBLOX_CURATED_UPSERT_CHUNK_SIZE, 200, 50, 1000);

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

type VotingDetails = {
  voteCount?: number | null;
  upVotePercent?: number | null;
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

type ChartPass = {
  chartType: string | null;
  sortCategory: string;
  label: string;
  maxPages: number;
};

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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
    limit: String(limit)
  });
  const url = `${TOP_SONGS_API}?${params.toString()}`;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
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

async function fetchToolboxMusicPage(pageToken: string | null, pass: ChartPass): Promise<ToolboxSearchResponse> {
  const params = new URLSearchParams({
    searchCategoryType: "Audio",
    maxPageSize: String(TOOLBOX_PAGE_SIZE),
    searchView: TOOLBOX_SEARCH_VIEW,
    sortCategory: pass.sortCategory,
    sortDirection: TOOLBOX_SORT_DIRECTION,
    includeOnlyVerifiedCreators: "false"
  });
  params.append("audioTypes", "Music");
  if (pass.chartType) {
    params.set("includeTopCharts", "true");
    params.set("musicChartType", pass.chartType);
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
        "user-agent": USER_AGENT
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
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
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

function buildToolboxRows(
  assets: CreatorStoreAsset[],
  fetchedAt: string,
  source: string,
  pass: ChartPass,
  rankOffset: number
): MusicRow[] {
  const rows: MusicRow[] = [];
  assets.forEach((entry, index) => {
    const asset = entry.asset ?? null;
    if (!asset || typeof asset.id !== "number") return;
    const previewId = asset.previewAssets?.imagePreviewAssets?.[0] ?? null;
    const voteCount = typeof entry.voting?.voteCount === "number" ? entry.voting.voteCount : null;
    const upvotePercent = typeof entry.voting?.upVotePercent === "number" ? entry.voting.upVotePercent : null;
    const creatorVerified = typeof entry.creator?.verified === "boolean" ? entry.creator.verified : null;
    const chartRank = pass.chartType ? rankOffset + index + 1 : null;
    const rawPayload = {
      ...entry,
      _meta: {
        chartType: pass.chartType,
        sortCategory: pass.sortCategory,
        chartRank
      }
    } as Record<string, unknown>;

    rows.push({
      asset_id: asset.id,
      title: normalizeRequiredText(asset.title ?? asset.name ?? undefined, "Unknown Title"),
      artist: normalizeRequiredText(asset.artist ?? undefined, "Unknown Artist"),
      album: normalizeOptionalText(asset.album ?? null),
      genre: normalizeOptionalText(asset.genre ?? null),
      duration_seconds: typeof asset.durationSeconds === "number" ? asset.durationSeconds : null,
      album_art_asset_id: typeof previewId === "number" ? previewId : null,
      rank: null,
      source,
      vote_count: voteCount,
      upvote_percent: upvotePercent,
      creator_verified: creatorVerified,
      raw_payload: rawPayload,
      last_seen_at: fetchedAt
    });
  });
  return rows;
}

async function collectTopSongs(seen: Set<number>, maxAssets: number | null): Promise<number> {
  const fetchedAt = new Date().toISOString();
  const seenTokens = new Set<string>();
  let pageToken: string | null = "0";
  let rankOffset = 0;
  let totalUpserts = 0;
  let pageCount = 0;

  console.log(`Top songs limit set to ${TOP_SONGS_PAGE_LIMIT}.`);
  while (pageToken && pageCount < TOP_SONGS_MAX_PAGES) {
    const remaining = maxAssets === null ? Number.POSITIVE_INFINITY : maxAssets - totalUpserts;
    if (remaining <= 0) break;

    if (seenTokens.has(pageToken)) {
      console.log(`Stopping top songs: pageToken ${pageToken} repeated.`);
      break;
    }
    seenTokens.add(pageToken);

    const payload = await fetchTopSongsPage(pageToken, TOP_SONGS_PAGE_LIMIT);
    const songs = Array.isArray(payload.songs) ? payload.songs : [];
    if (!songs.length) {
      console.log("No top songs returned; stopping.");
      break;
    }

    const rows = buildTopSongRows(songs, fetchedAt, rankOffset).filter((row) => {
      if (seen.has(row.asset_id)) return false;
      seen.add(row.asset_id);
      return true;
    });

    const slice = remaining < rows.length ? rows.slice(0, remaining) : rows;
    if (slice.length) {
      await upsertRows(slice);
      totalUpserts += slice.length;
    }

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

async function collectCreatorStoreCharts(seen: Set<number>, maxAssets: number | null): Promise<number> {
  const fetchedAt = new Date().toISOString();
  let totalUpserts = 0;

  const passes: ChartPass[] = TOOLBOX_CHART_TYPES.map((chartType) => ({
    chartType,
    sortCategory: TOOLBOX_SORT_CATEGORY,
    label: `chart:${chartType}`,
    maxPages: TOOLBOX_MAX_PAGES
  }));

  if (TOOLBOX_INCLUDE_TRENDING) {
    passes.push({
      chartType: null,
      sortCategory: "Trending",
      label: "trending",
      maxPages: TOOLBOX_TRENDING_PAGES
    });
  }

  for (const pass of passes) {
    const remaining = maxAssets === null ? Number.POSITIVE_INFINITY : maxAssets - totalUpserts;
    if (remaining <= 0) break;

    console.log(`Creator Store pass ${pass.label}...`);
    const seenTokens = new Set<string>();
    let pageToken: string | null = null;
    let pageCount = 0;
    let rankOffset = 0;

    while (pageCount < pass.maxPages) {
      const remainingInPass = maxAssets === null ? Number.POSITIVE_INFINITY : maxAssets - totalUpserts;
      if (remainingInPass <= 0) break;

      if (pageToken && seenTokens.has(pageToken)) {
        console.log(`Stopping pass ${pass.label}: pageToken ${pageToken} repeated.`);
        break;
      }
      if (pageToken) {
        seenTokens.add(pageToken);
      }

      const payload = await fetchToolboxMusicPage(pageToken, pass);
      const assets = Array.isArray(payload.creatorStoreAssets) ? payload.creatorStoreAssets : [];
      if (!assets.length) {
        console.log(`No assets returned for ${pass.label}.`);
        break;
      }

      const source = pass.chartType
        ? `creator_store_top_${pass.chartType.toLowerCase()}`
        : "creator_store_trending";
      const rows = buildToolboxRows(assets, fetchedAt, source, pass, rankOffset).filter((row) => {
        if (seen.has(row.asset_id)) return false;
        seen.add(row.asset_id);
        return true;
      });

      const slice = remainingInPass < rows.length ? rows.slice(0, remainingInPass) : rows;
      if (slice.length) {
        await upsertRows(slice);
        totalUpserts += slice.length;
      }

      pageCount += 1;
      rankOffset += assets.length;

      const nextToken =
        typeof payload.nextPageToken === "string" && payload.nextPageToken.trim().length
          ? payload.nextPageToken.trim()
          : null;
      pageToken = nextToken;

      if (!pageToken) break;
      await sleep(TOOLBOX_DELAY_MS);
    }
  }

  console.log(`Upserted ${totalUpserts} Creator Store chart assets.`);
  return totalUpserts;
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const maxAssets = MAX_ASSETS > 0 ? MAX_ASSETS : null;
  const seenAssetIds = new Set<number>();

  const topSongsCount = await collectTopSongs(seenAssetIds, maxAssets);
  const remaining = maxAssets === null ? null : Math.max(0, maxAssets - topSongsCount);
  const chartCount = await collectCreatorStoreCharts(seenAssetIds, remaining);

  console.log(`Done. Top songs: ${topSongsCount}. Creator Store charts: ${chartCount}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
