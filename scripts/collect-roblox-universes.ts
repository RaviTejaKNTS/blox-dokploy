import "dotenv/config";

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";

const EXPLORE_BASE = "https://apis.roblox.com/explore-api/v1";
const DEVICES = ["computer", "phone", "tablet", "console", "vr"];
const COUNTRIES = ["us"];
const CPU_CORES = process.env.ROBLOX_CPU_CORES ?? "8";
const MAX_RESOLUTION = process.env.ROBLOX_MAX_RESOLUTION ?? "1440x900";
const MAX_MEMORY = process.env.ROBLOX_MAX_MEMORY ?? "8192";
const NETWORK_TYPE = process.env.ROBLOX_NETWORK_TYPE ?? "4g";

const BASE_QUERY_PARAMS: Record<string, string> = {};
if (CPU_CORES) BASE_QUERY_PARAMS.cpuCores = CPU_CORES;
if (MAX_RESOLUTION) BASE_QUERY_PARAMS.maxResolution = MAX_RESOLUTION;
if (MAX_MEMORY) BASE_QUERY_PARAMS.maxMemory = MAX_MEMORY;
if (NETWORK_TYPE) BASE_QUERY_PARAMS.networkType = NETWORK_TYPE;

type ExploreSort = {
  sortId: string;
  name?: string;
  title?: string;
  description?: string;
  displayName?: string;
  token?: string;
  sortToken?: string;
  extraParams?: Record<string, string>;
  [key: string]: unknown;
};

type ExtraSortConfig = {
  sortId: string;
  title?: string;
  params?: Record<string, string>;
};

const DISCOVER_SESSION_ID = process.env.ROBLOX_DISCOVER_SESSION ?? "c598edd3-4976-4636-a860-8cf205f17ed2";

const DEFAULT_EXTRA_SORTS: ExtraSortConfig[] = [
  { sortId: "trending-in-rpg", title: "Trending in RPG" },
  { sortId: "trending-music-experiences", title: "Trending in Music" },
  { sortId: "most-popular", title: "Most Popular" },
  { sortId: "trending-in-sports-and-racing", title: "Trending in Sports & Racing" },
  { sortId: "trending-in-shooter", title: "Trending in Shooter" },
  { sortId: "trending-in-action", title: "Trending in Action" },
  { sortId: "trending-in-adventure", title: "Trending in Adventure" },
  {
    sortId: "trending-in-entertainment",
    title: "Trending in Entertainment",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "654",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "16",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-obby-and-platformer",
    title: "Trending in Obby & Platformer",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "655",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "17",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-party-and-casual",
    title: "Trending in Party & Casual",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "656",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "18",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-puzzle",
    title: "Trending in Puzzle",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "657",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "19",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-roleplay-and-avatar-sim",
    title: "Trending in Roleplay & Avatar Sim",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "659",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "20",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-shopping",
    title: "Trending in Shopping",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "661",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "21",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-simulation",
    title: "Trending in Simulation",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "662",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "22",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-strategy",
    title: "Trending in Strategy",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "665",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "23",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "trending-in-survival",
    title: "Trending in Survival",
    params: {
      age: "all",
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "666",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "24",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "try-voice-chat",
    title: "Try Voice Chat",
    params: {
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "217",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "25",
      treatmentType: "Carousel"
    }
  },
  {
    sortId: "learning-and-explore",
    title: "Learning & Explore",
    params: {
      discoverPageSessionInfo: DISCOVER_SESSION_ID,
      gameSetTargetId: "218",
      gameSetTypeId: "23",
      page: "gamesPage",
      position: "26",
      treatmentType: "Carousel"
    }
  },
  { sortId: "top-earning", title: "Top Earning" },
  { sortId: "top-paid-access", title: "Top Paid Access" },
  { sortId: "top-rated", title: "Top Rated" }
];

function loadExtraSorts(): ExtraSortConfig[] {
  const fromEnv = process.env.ROBLOX_EXTRA_SORTS;
  if (!fromEnv) return DEFAULT_EXTRA_SORTS;
  return fromEnv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((sortId) => ({ sortId }));
}

type ExploreGameEntry = {
  universeId?: number | string;
  placeId?: number | string;
  rootPlaceId?: number | string;
  name?: string;
  displayName?: string;
  creatorId?: number | string;
  creatorName?: string;
  creatorType?: string;
  creatorHasVerifiedBadge?: boolean;
  hasVerifiedBadge?: boolean;
  genre?: string;
  isSponsored?: boolean;
  ageRecommendation?: string;
  playing?: number;
  playerCount?: number;
  visits?: number;
  favorites?: number;
  favoriteCount?: number;
  likes?: number;
  upVotes?: number;
  downVotes?: number;
  thumbnails?: Array<{ imageUrl?: string; thumbnailUrl?: string; type?: string; thumbnailType?: string }>;
  [key: string]: unknown;
};

type SortContentResponse = {
  games?: ExploreGameEntry[];
  gameList?: ExploreGameEntry[];
  content?: ExploreGameEntry[];
  nextPageToken?: string | null;
  [key: string]: unknown;
};

type FetchResult = {
  sortsProcessed: number;
  entriesStored: number;
  universesSeen: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

function toSlug(value?: string | null): string | null {
  if (!value) return null;
  const slug = slugify(value);
  return slug || null;
}

async function fetchJson(url: string, label: string): Promise<any> {
  const res = await fetch(url, { headers: { "user-agent": "BloxodesExploreBot/1.0" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch ${label} (${res.status}): ${body}`);
  }
  return res.json();
}

async function fetchSorts(sessionId: string, device: string, country: string): Promise<ExploreSort[]> {
  const params = new URLSearchParams({
    device,
    country,
    sessionId
  });
  for (const [key, value] of Object.entries(BASE_QUERY_PARAMS)) {
    if (value != null) {
      params.set(key, value);
    }
  }
  const data = await fetchJson(`${EXPLORE_BASE}/get-sorts?${params.toString()}`, "sorts");
  if (Array.isArray(data?.sorts)) return data.sorts as ExploreSort[];
  if (Array.isArray(data?.sortsV2)) return data.sortsV2 as ExploreSort[];
  console.warn("⚠️ Unexpected explore sorts payload shape. Returning empty list.");
  return [];
}

function extractGames(payload: SortContentResponse): ExploreGameEntry[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.games)) return payload.games;
  if (Array.isArray(payload.gameList)) return payload.gameList;
  if (Array.isArray(payload.content)) return payload.content;
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && "universeId" in (value[0] as any)) {
        return value as ExploreGameEntry[];
      }
    }
  }
  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeThumbnails(entry: ExploreGameEntry) {
  const thumbnails = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  return thumbnails
    .map((thumb) => {
      if (!thumb) return null;
      const url = thumb.imageUrl ?? thumb.thumbnailUrl;
      if (!url) return null;
      return {
        url,
        type: thumb.thumbnailType ?? thumb.type ?? null
      };
    })
    .filter((value): value is { url: string; type: string | null } => Boolean(value?.url));
}

async function collectSortContent(
  sort: ExploreSort,
  sessionId: string,
  runId: string,
  fetchedAt: string,
  sb: ReturnType<typeof supabaseAdmin>,
  globalSeen: Set<number>,
  device: string,
  country: string
): Promise<{ entries: number; universes: number; recordedSnapshotCount: number }> {
  const sortId = sort.sortId;
  let nextToken: string | null | undefined;
  let rankOffset = 0;
  let entriesStored = 0;
  const seen = new Set<number>();
  let snapshotsRecorded = 0;

  do {
    const params = new URLSearchParams({
      device,
      country,
      sessionId,
      sortId
    });
    for (const [key, value] of Object.entries(BASE_QUERY_PARAMS)) {
      if (value != null) {
        params.set(key, value);
      }
    }
    if (sort.token || sort.sortToken) {
      params.set("sortToken", String(sort.token ?? sort.sortToken));
    }
    if (sort.extraParams) {
      for (const [key, value] of Object.entries(sort.extraParams)) {
        if (value != null) {
          params.set(key, value);
        }
      }
    }
    if (nextToken) {
      params.set("pageToken", nextToken);
    }
    const payload = await fetchJson(`${EXPLORE_BASE}/get-sort-content?${params.toString()}`, `sort content ${sortId}`);
    const games = extractGames(payload);
    if (!games.length) break;

    const insertUniversesPayload: any[] = [];
    const sortEntriesPayload: any[] = [];
    const now = new Date().toISOString();
    const statDate = todayIsoDate();

    games.forEach((game, index) => {
      const universeId = toNumber(game.universeId);
      const rootPlaceId = toNumber(game.rootPlaceId ?? game.placeId);
      if (!universeId || !rootPlaceId) {
        return;
      }
      const rank = rankOffset + index + 1;
      if (seen.has(universeId)) return;
      seen.add(universeId);
      globalSeen.add(universeId);

      const baseName = game.displayName ?? game.name ?? null;
      insertUniversesPayload.push({
        universe_id: universeId,
        root_place_id: rootPlaceId,
        name: baseName ?? `Universe ${universeId}`,
        display_name: baseName ?? null,
        slug: null,
        description: null,
        description_source: null,
        creator_id: null,
        creator_name: null,
        creator_type: null,
        creator_has_verified_badge: null,
        genre: null,
        genre_l1: null,
        genre_l2: null,
        is_all_genre: null,
        price: null,
        voice_chat_enabled: null,
        server_size: null,
        max_players: null,
        playing: null,
        visits: null,
        favorites: null,
        likes: null,
        dislikes: null,
        is_sponsored: null,
        age_rating: null,
        icon_url: null,
        thumbnail_urls: [],
        social_links: {},
        raw_metadata: {
          source: "explore",
          sort_id: sortId,
          sort_title: sort.title ?? sort.displayName ?? sortId,
          rank,
          device,
          country
        },
        raw_details: {},
        last_seen_in_sort: now
      });

      sortEntriesPayload.push({
        sort_id: sortId,
        universe_id: universeId,
        place_id: rootPlaceId,
        rank,
        session_id: sessionId,
        run_id: runId,
        device,
        country,
        source: "explore",
        is_sponsored: Boolean(game.isSponsored ?? false),
        fetched_at: fetchedAt
      });
    });

    if (insertUniversesPayload.length) {
      const { error } = await sb.from("roblox_universes").upsert(insertUniversesPayload, {
        onConflict: "universe_id",
        ignoreDuplicates: true
      });
      if (error) {
        throw new Error(`Failed to insert roblox_universes: ${error.message}`);
      }
    }

    if (sortEntriesPayload.length) {
      const { error } = await sb.from("roblox_universe_sort_entries").insert(sortEntriesPayload).select("id");
      if (error && !error.message.includes("duplicate key")) {
        throw new Error(`Failed to insert sort entries: ${error.message}`);
      }
    }

    // Skip daily stats when only inserting minimal universe records
    entriesStored += sortEntriesPayload.length;
    rankOffset += games.length;
    nextToken = typeof payload?.nextPageToken === "string" && payload.nextPageToken.length ? payload.nextPageToken : null;

    if (nextToken) {
      await sleep(200);
    }
  } while (nextToken);

  return { entries: entriesStored, universes: seen.size, recordedSnapshotCount: snapshotsRecorded };
}

async function run(): Promise<FetchResult> {
  const sb = supabaseAdmin();
  let sortsProcessed = 0;
  let totalEntries = 0;
  const globalSeen = new Set<number>();

  for (const device of DEVICES) {
    for (const country of COUNTRIES) {
      const sessionId = randomUUID();
      const runStartedAt = new Date().toISOString();

      console.log(`🚀 Starting Roblox explore crawl (session ${sessionId}, device ${device}, country ${country})...`);
      const sorts = await fetchSorts(sessionId, device, country);
      const existingSortIds = new Set(sorts.map((sort) => sort.sortId));
      const extraSorts = loadExtraSorts().filter((extra) => !existingSortIds.has(extra.sortId));
      for (const extra of extraSorts) {
        sorts.push({
          sortId: extra.sortId,
          title: extra.title ?? extra.sortId,
          extraParams: extra.params ?? {}
        });
      }

      if (!sorts.length) {
        console.log("ℹ️ No sorts returned; skipping.");
        continue;
      }
      console.log(`📋 Retrieved ${sorts.length} sorts (including ${extraSorts.length} extras).`);

      const { data: runRecord, error: runError } = await sb
        .from("roblox_universe_sort_runs")
        .insert({
          session_id: sessionId,
          device,
          country,
          retrieved_at: runStartedAt
        })
        .select("id")
        .single();

      if (runError || !runRecord) {
        console.error(`Failed to record sort run for ${device}/${country}: ${runError?.message ?? "unknown error"}`);
        continue;
      }

      for (const sort of sorts) {
        if (!sort.sortId) continue;
        const definitionPayload = {
          sort_id: sort.sortId,
          title: sort.title ?? sort.displayName ?? sort.name ?? null,
          description: sort.description ?? null,
          layout: sort.layout ?? sort.layoutType ?? {},
          experiments: sort.experiments ?? {},
          last_seen_at: runStartedAt
        };
        const { error: definitionError } = await sb.from("roblox_universe_sort_definitions").upsert(definitionPayload, {
          onConflict: "sort_id"
        });
        if (definitionError) {
          console.warn(`⚠️ Failed to upsert sort definition for ${sort.sortId}: ${definitionError.message}`);
          continue;
        }

        try {
          const { entries, universes, recordedSnapshotCount } = await collectSortContent(
            sort,
            sessionId,
            runRecord.id,
            runStartedAt,
            sb,
            globalSeen,
            device,
            country
          );
          sortsProcessed += 1;
          totalEntries += entries;
          console.log(
            ` • ${sort.title ?? sort.sortId}: ${entries} entries (${universes} unique universes, ${recordedSnapshotCount} snapshots)`
          );
        } catch (error) {
          console.error(`❌ Failed to process sort ${sort.sortId} (${device}/${country}):`, (error as Error).message);
        }
      }
    }
  }

  console.log(
    `✅ Explore crawl complete: ${sortsProcessed} sorts, ${totalEntries} entries stored, ${globalSeen.size} total unique universes`
  );

  return { sortsProcessed, entriesStored: totalEntries, universesSeen: globalSeen.size };
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Explore crawl failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
