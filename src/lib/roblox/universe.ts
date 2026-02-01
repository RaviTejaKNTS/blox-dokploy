import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { extractPlaceId, scrapeRobloxGameMetadata, type RobloxGameMetadata } from "@/lib/roblox/game-metadata";

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "BloxodesUniverseLinker/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

const PLACE_DETAILS_API = "https://games.roblox.com/v1/games/multiget-place-details";
const GAME_DETAILS_API = "https://games.roblox.com/v1/games";

type RobloxPlaceDetail = {
  placeId: number;
  universeId?: number;
  name?: string;
  rootPlaceId?: number;
};

type RobloxGameDetail = {
  id: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  created?: string;
  updated?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  genre?: string;
  price?: number;
  voiceEnabled?: boolean;
  serverSize?: number;
  maxPlayers?: number;
  playing?: number;
  visits?: number;
  favorites?: number;
  favoritedCount?: number;
  votes?: { upVotes?: number; downVotes?: number };
  totalUpVotes?: number;
  totalDownVotes?: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Roblox API ${url} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function fetchPlaceDetails(placeId: string): Promise<RobloxPlaceDetail | null> {
  const payload = await fetchJson<Array<RobloxPlaceDetail>>(`${PLACE_DETAILS_API}?placeIds=${placeId}`).catch(
    () => null
  );
  if (!payload?.length) return null;
  const entry = payload[0];
  if (!entry || typeof entry.placeId !== "number") return null;
  return entry;
}

async function fetchUniverseDetails(universeId: number): Promise<RobloxGameDetail | null> {
  const payload = await fetchJson<{ data?: RobloxGameDetail[] }>(`${GAME_DETAILS_API}?universeIds=${universeId}`).catch(
    () => null
  );
  const entry = payload?.data?.[0];
  if (!entry || typeof entry.id !== "number") return null;
  return entry;
}

function boolValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

async function safeScrapeMetadata(robloxLink: string): Promise<RobloxGameMetadata | null> {
  try {
    return await scrapeRobloxGameMetadata(robloxLink);
  } catch {
    return null;
  }
}

export async function ensureUniverseForRobloxLink(
  supabase: SupabaseClient,
  robloxLink?: string | null
): Promise<{ universeId: number | null; rootPlaceId: number | null }> {
  if (!robloxLink) {
    return { universeId: null, rootPlaceId: null };
  }
  let scrapedMetadata: RobloxGameMetadata | null = null;
  let placeId = extractPlaceId(robloxLink);
  if (!placeId) {
    scrapedMetadata = await safeScrapeMetadata(robloxLink);
    placeId = scrapedMetadata?.placeId ?? null;
  }

  const placeDetails = placeId ? await fetchPlaceDetails(placeId) : null;
  let universeId = placeDetails?.universeId ?? null;

  if (!universeId) {
    scrapedMetadata = scrapedMetadata ?? (await safeScrapeMetadata(robloxLink));
    universeId = numberValue(scrapedMetadata?.universeId);
  }

  if (!universeId) {
    return {
      universeId: null,
      rootPlaceId: placeDetails?.rootPlaceId ?? numberValue(scrapedMetadata?.placeId) ?? null
    };
  }

  const { data: existing, error } = await supabase
    .from("roblox_universes")
    .select("universe_id, root_place_id")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  if (existing?.universe_id) {
    const fallbackRoot =
      (existing.root_place_id as number | null) ??
      placeDetails?.rootPlaceId ??
      numberValue(placeId);
    return {
      universeId,
      rootPlaceId: fallbackRoot ?? null
    };
  }

  const gameDetail = await fetchUniverseDetails(universeId);
  const fallbackRoot =
    gameDetail?.rootPlaceId ??
    placeDetails?.rootPlaceId ??
    numberValue(scrapedMetadata?.placeId) ??
    numberValue(placeId);
  if (fallbackRoot == null) {
    throw new Error(`Unable to determine root place for universe ${universeId}`);
  }

  const canonicalName =
    gameDetail?.name ??
    placeDetails?.name ??
    scrapedMetadata?.genre ??
    `Universe ${universeId}`;
  const slug = slugify(canonicalName);
  const favorites = gameDetail?.favorites ?? gameDetail?.favoritedCount ?? null;
  const votes = gameDetail?.votes ?? {};
  const likes = votes?.upVotes ?? gameDetail?.totalUpVotes ?? null;
  const dislikes = votes?.downVotes ?? gameDetail?.totalDownVotes ?? null;
  const createdAtApi = normalizeTimestamp(gameDetail?.created ?? null);
  const updatedAtApi = normalizeTimestamp(gameDetail?.updated ?? null);

  const insertPayload = {
    universe_id: universeId,
    root_place_id: fallbackRoot,
    name: canonicalName,
    display_name: canonicalName,
    slug: slug ?? null,
    description: gameDetail?.description ?? null,
    description_source: gameDetail?.description ? "games_api" : null,
    creator_id: gameDetail?.creator?.id ?? null,
    creator_name: gameDetail?.creator?.name ?? null,
    creator_type: gameDetail?.creator?.type ?? null,
    creator_has_verified_badge: boolValue(gameDetail?.creator?.hasVerifiedBadge),
    genre: gameDetail?.genre ?? null,
    genre_l1: gameDetail?.genre ?? null,
    genre_l2: null,
    is_all_genre: gameDetail?.genre ? gameDetail.genre.toLowerCase().includes("all") : null,
    price: gameDetail?.price ?? null,
    voice_chat_enabled: boolValue(gameDetail?.voiceEnabled),
    server_size: gameDetail?.serverSize ?? null,
    max_players: gameDetail?.maxPlayers ?? null,
    playing: gameDetail?.playing ?? null,
    visits: gameDetail?.visits ?? null,
    favorites,
    likes,
    dislikes,
    created_at_api: createdAtApi,
    updated_at_api: updatedAtApi,
    raw_details: {
      source: "games_api",
      fetched_at: new Date().toISOString(),
      data: gameDetail
    },
    raw_metadata: {
      source: "ensure_universe_for_roblox_link",
      placeId: placeId ?? scrapedMetadata?.placeId ?? null,
      scraped: scrapedMetadata ?? undefined
    }
  };

  const { error: insertError } = await supabase.from("roblox_universes").insert(insertPayload);
  if (insertError) {
    throw new Error(`Failed to insert universe ${universeId}: ${insertError.message}`);
  }

  return {
    universeId,
    rootPlaceId: insertPayload.root_place_id
  };
}
