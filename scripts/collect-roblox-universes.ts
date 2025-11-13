import "dotenv/config";

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase";

const EXPLORE_BASE = "https://apis.roblox.com/explore-api/v1";
const DEVICE = process.env.ROBLOX_DEVICE ?? "computer";
const COUNTRY = process.env.ROBLOX_COUNTRY ?? "all";

type ExploreSort = {
  sortId: string;
  name?: string;
  title?: string;
  description?: string;
  displayName?: string;
  token?: string;
  sortToken?: string;
  [key: string]: unknown;
};

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

async function fetchJson(url: string, label: string): Promise<any> {
  const res = await fetch(url, { headers: { "user-agent": "BloxodesExploreBot/1.0" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch ${label} (${res.status}): ${body}`);
  }
  return res.json();
}

async function fetchSorts(sessionId: string): Promise<ExploreSort[]> {
  const params = new URLSearchParams({
    device: DEVICE,
    country: COUNTRY,
    sessionId
  });
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

async function fetchSortEntries(sort: ExploreSort, sessionId: string) {
  const params = new URLSearchParams({
    device: DEVICE,
    country: COUNTRY,
    sessionId,
    sortId: sort.sortId ?? String(sort.name ?? "")
  });
  if (sort.token || sort.sortToken) {
    params.set("sortToken", String(sort.token ?? sort.sortToken));
  }
  return fetchJson(`${EXPLORE_BASE}/get-sort-content?${params.toString()}`, `sort ${sort.sortId}`);
}

async function collectSortContent(
  sort: ExploreSort,
  sessionId: string,
  runId: string,
  fetchedAt: string
): Promise<{ entries: number; universes: number }> {
  const sb = supabaseAdmin();
  const sortId = sort.sortId;
  let nextToken: string | null | undefined;
  let rankOffset = 0;
  let entriesStored = 0;
  const seen = new Set<number>();

  do {
    const params = new URLSearchParams({
      device: DEVICE,
      country: COUNTRY,
      sessionId,
      sortId
    });
    if (sort.token || sort.sortToken) {
      params.set("sortToken", String(sort.token ?? sort.sortToken));
    }
    if (nextToken) {
      params.set("pageToken", nextToken);
    }
    const payload = await fetchJson(`${EXPLORE_BASE}/get-sort-content?${params.toString()}`, `sort content ${sortId}`);
    const games = extractGames(payload);
    if (!games.length) break;

    const upsertGamesPayload: any[] = [];
    const sortEntriesPayload: any[] = [];
    const now = new Date().toISOString();

    games.forEach((game, index) => {
      const universeId = toNumber(game.universeId);
      const rootPlaceId = toNumber(game.rootPlaceId ?? game.placeId);
      if (!universeId || !rootPlaceId) {
        return;
      }
      const rank = rankOffset + index + 1;
      if (seen.has(universeId)) return;
      seen.add(universeId);

      const stats = {
        playing: game.playing ?? game.playerCount ?? null,
        favorites: game.favorites ?? game.favoriteCount ?? null,
        visits: game.visits ?? null,
        votes: {
          up: game.likes ?? game.upVotes ?? null,
          down: game.downVotes ?? null
        }
      };

      const thumbnails = normalizeThumbnails(game);
      const iconUrl = thumbnails.find((thumb) => thumb.type === "Icon")?.url ?? thumbnails[0]?.url ?? null;

      upsertGamesPayload.push({
        universe_id: universeId,
        root_place_id: rootPlaceId,
        name: game.name ?? game.displayName ?? `Universe ${universeId}`,
        display_name: game.displayName ?? null,
        description: typeof game.description === "string" ? game.description : null,
        creator_id: toNumber(game.creatorId),
        creator_name: game.creatorName ?? null,
        creator_type: game.creatorType ?? null,
        creator_has_verified_badge: Boolean(game.creatorHasVerifiedBadge ?? game.hasVerifiedBadge ?? false),
        genre: game.genre ?? null,
        source_name: sort.title ?? sort.displayName ?? sortId,
        source_session_id: sessionId,
        price: toNumber(game.price ?? game.accessPrice),
        voice_enabled: Boolean(game.voiceEnabled ?? false),
        server_size: toNumber(game.serverSize) ?? null,
        max_players: toNumber(game.maxPlayers) ?? null,
        playing: stats.playing ?? null,
        visits: stats.visits ?? null,
        favorites: stats.favorites ?? null,
        likes: stats.votes.up ?? null,
        dislikes: stats.votes.down ?? null,
        age_recommendation: game.ageRecommendation ?? null,
        is_sponsored: Boolean(game.isSponsored ?? false),
        has_verified_badge: Boolean(game.hasVerifiedBadge ?? false),
        icon_url: iconUrl,
        thumbnail_urls: thumbnails,
        stats,
        raw_details: game,
        last_seen_in_sort: now
      });

      sortEntriesPayload.push({
        sort_id: sortId,
        universe_id: universeId,
        place_id: rootPlaceId,
        rank,
        session_id: sessionId,
        run_id: runId,
        device: DEVICE,
        country: COUNTRY,
        source: "explore",
        is_sponsored: Boolean(game.isSponsored ?? false),
        fetched_at: fetchedAt
      });
    });

    if (upsertGamesPayload.length) {
      const { error } = await sb.from("roblox_games").upsert(upsertGamesPayload, { onConflict: "universe_id" });
      if (error) {
        throw new Error(`Failed to upsert roblox_games: ${error.message}`);
      }
    }

    if (sortEntriesPayload.length) {
      const { error } = await sb.from("roblox_sort_entries").insert(sortEntriesPayload).select("id");
      if (error && !error.message.includes("duplicate key")) {
        throw new Error(`Failed to insert sort entries: ${error.message}`);
      }
    }

    entriesStored += sortEntriesPayload.length;
    rankOffset += games.length;
    nextToken = typeof payload?.nextPageToken === "string" && payload.nextPageToken.length ? payload.nextPageToken : null;

    if (nextToken) {
      await sleep(200);
    }
  } while (nextToken);

  return { entries: entriesStored, universes: seen.size };
}

async function run(): Promise<FetchResult> {
  const sessionId = randomUUID();
  const sb = supabaseAdmin();
  const runStartedAt = new Date().toISOString();

  console.log(`🚀 Starting Roblox explore crawl (session ${sessionId})...`);
  const sorts = await fetchSorts(sessionId);
  if (!sorts.length) {
    console.log("ℹ️ No sorts returned; exiting.");
    return { sortsProcessed: 0, entriesStored: 0, universesSeen: 0 };
  }
  console.log(`📋 Retrieved ${sorts.length} sorts.`);

  const { data: runRecord, error: runError } = await sb
    .from("roblox_sort_runs")
    .insert({
      session_id: sessionId,
      device: DEVICE,
      country: COUNTRY,
      retrieved_at: runStartedAt
    })
    .select("id")
    .single();

  if (runError || !runRecord) {
    throw new Error(`Failed to record sort run: ${runError?.message ?? "unknown error"}`);
  }

  let sortsProcessed = 0;
  let totalEntries = 0;
  let totalUniverses = 0;

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
    const { error: definitionError } = await sb.from("roblox_sort_definitions").upsert(definitionPayload, {
      onConflict: "sort_id"
    });
    if (definitionError) {
      console.warn(`⚠️ Failed to upsert sort definition for ${sort.sortId}: ${definitionError.message}`);
      continue;
    }

    try {
      const { entries, universes } = await collectSortContent(sort, sessionId, runRecord.id, runStartedAt);
      sortsProcessed += 1;
      totalEntries += entries;
      totalUniverses += universes;
      console.log(` • ${sort.title ?? sort.sortId}: ${entries} entries (${universes} unique universes)`);
    } catch (error) {
      console.error(`❌ Failed to process sort ${sort.sortId}:`, (error as Error).message);
    }
  }

  console.log(
    `✅ Explore crawl complete: ${sortsProcessed} sorts, ${totalEntries} entries stored, ${totalUniverses} unique universes`
  );

  return { sortsProcessed, entriesStored: totalEntries, universesSeen: totalUniverses };
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Explore crawl failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
