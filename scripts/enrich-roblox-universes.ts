import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";

const GAME_DETAILS_API = "https://games.roblox.com/v1/games";
const GAME_ICONS_API = "https://thumbnails.roblox.com/v1/games/icons";
const GAME_THUMBS_API = "https://thumbnails.roblox.com/v1/games/multiget/thumbnails";
const PASSES_API = (universeId: number) => `https://games.roblox.com/v1/games/${universeId}/game-passes`;
const BADGES_API = (universeId: number) => `https://badges.roblox.com/v1/universes/${universeId}/badges`;
const OPEN_CLOUD_BASE = "https://apis.roblox.com";
const OPEN_CLOUD_UNIVERSE_PATH = "/cloud/v2/universes";
const OPEN_CLOUD_CONCURRENCY = Number(process.env.ROBLOX_OPEN_CLOUD_CONCURRENCY ?? "5");
const OPEN_CLOUD_API_KEY = process.env.ROBLOX_OPEN_CLOUD_API_KEY ?? process.env.ROBLOX_API_KEY ?? null;

const DEFAULT_TOTAL_LIMIT = Number(process.env.ROBLOX_ENRICH_LIMIT ?? "300");
const BATCH_SIZE = Number(process.env.ROBLOX_ENRICH_BATCH ?? "50");
const ATTACHMENT_CONCURRENCY = Number(process.env.ROBLOX_ENRICH_CONCURRENCY ?? "4");

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  last_seen_in_sort: string | null;
  updated_at: string | null;
  name?: string | null;
};

type RobloxGameDetail = {
  id: number;
  rootPlaceId?: number;
  name?: string;
  description?: string;
  sourceName?: string;
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
  totalUpVotes?: number;
  totalDownVotes?: number;
  allowedGearCategories?: string[];
  isExperimental?: boolean;
  isGenreEnforced?: boolean;
  isPlayable?: boolean;
  createVipServersAllowed?: boolean;
  studioAccessToApisAllowed?: boolean;
  universeAvatarType?: string;
  ageRecommendation?: string;
  isSponsoredGame?: boolean;
  hasVerifiedBadge?: boolean;
  pastDayVotes?: {
    upVotes?: number;
    downVotes?: number;
  };
  votes?: {
    upVotes?: number;
    downVotes?: number;
  };
  media?: unknown;
  [key: string]: unknown;
};

type IconResponse = {
  data?: Array<{
    targetId: number;
    state?: string;
    imageUrl?: string;
    universeId?: number;
    errorCode?: number;
    [key: string]: unknown;
  }>;
};

type ThumbnailResponse = {
  data?: Array<{
    universeId: number;
    thumbnails: Array<{
      imageUrl?: string;
      state?: string;
      thumbnailType?: string;
      thumbnailId?: number;
      errorCode?: number;
      [key: string]: unknown;
    }>;
  }>;
};

type GamePass = {
  id: number;
  productId?: number;
  name?: string;
  description?: string;
  price?: number;
  isForSale?: boolean;
  sales?: number;
  created?: string;
  updated?: string;
  iconImageId?: number;
  displayIconImageId?: number;
  [key: string]: unknown;
};

type Badge = {
  id: number;
  name?: string;
  description?: string;
  iconImageId?: number;
  awardingBadgeAssetId?: number;
  enabled?: boolean;
  created?: string;
  updated?: string;
  statistics?: {
    pastDayAwardedCount?: number;
    pastWeekAwardedCount?: number;
    awardedCount?: number;
  };
  displayIconImageId?: number;
  rarity?: number;
  [key: string]: unknown;
};

type UniverseSocialLinks = Record<string, Array<{ title?: string | null; url?: string | null }>>;

type UniverseMetadata = {
  raw: Record<string, unknown>;
  displayName?: string | null;
  description?: string | null;
  rootPlaceId?: number | null;
  voiceChatEnabled?: boolean | null;
  socialLinks?: UniverseSocialLinks;
  socialRaw?: Record<string, unknown> | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: string, label: string) {
  const res = await fetch(url, { headers: { "user-agent": "BloxodesUniverseEnricher/1.0" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch ${label} (${res.status}): ${body}`);
  }
  return res.json();
}

function ensureOpenCloudApiKey(): string {
  if (!OPEN_CLOUD_API_KEY) {
    throw new Error(
      "ROBLOX_OPEN_CLOUD_API_KEY (or ROBLOX_API_KEY) must be set to call Roblox Open Cloud endpoints."
    );
  }
  return OPEN_CLOUD_API_KEY;
}

function parseRootPlaceIdFromPath(pathValue?: string | null): number | null {
  if (!pathValue) return null;
  const match = /places\/(\d+)/i.exec(pathValue);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

const UNIVERSE_SOCIAL_FIELDS: Array<{ key: string; field: string }> = [
  { key: "facebook", field: "facebookSocialLink" },
  { key: "twitter", field: "twitterSocialLink" },
  { key: "youtube", field: "youtubeSocialLink" },
  { key: "twitch", field: "twitchSocialLink" },
  { key: "discord", field: "discordSocialLink" },
  { key: "roblox_group", field: "robloxGroupSocialLink" },
  { key: "guilded", field: "guildedSocialLink" }
];

function extractSocialLinksFromMetadata(raw: Record<string, unknown>) {
  const socialLinks: UniverseSocialLinks = {};
  const socialRaw: Record<string, unknown> = {};
  let count = 0;
  for (const { key, field } of UNIVERSE_SOCIAL_FIELDS) {
    const value = raw[field as keyof typeof raw] as { title?: string; uri?: string } | undefined;
    if (!value || typeof value !== "object") continue;
    const uri = typeof value.uri === "string" ? value.uri.trim() : "";
    if (!uri) continue;
    if (!socialLinks[key]) {
      socialLinks[key] = [];
    }
    socialLinks[key].push({
      title: typeof value.title === "string" ? value.title : null,
      url: uri
    });
    socialRaw[field as string] = value;
    count += 1;
  }
  return {
    links: count > 0 ? socialLinks : undefined,
    raw: count > 0 ? socialRaw : undefined
  };
}

async function fetchUniverseMetadata(universeIds: number[]): Promise<Map<number, UniverseMetadata>> {
  if (!universeIds.length) return new Map();
  const apiKey = ensureOpenCloudApiKey();
  const results = new Map<number, UniverseMetadata>();

  await promisePool(universeIds, OPEN_CLOUD_CONCURRENCY, async (universeId) => {
    const url = `${OPEN_CLOUD_BASE}${OPEN_CLOUD_UNIVERSE_PATH}/${universeId}`;
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "BloxodesUniverseEnricher/1.0",
          "x-api-key": apiKey
        }
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Failed (${res.status}): ${body || res.statusText}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const rootPlaceId = parseRootPlaceIdFromPath(data.rootPlace as string | undefined);
      const social = extractSocialLinksFromMetadata(data);
      results.set(universeId, {
        raw: data,
        displayName: typeof data.displayName === "string" ? data.displayName : null,
        description: typeof data.description === "string" ? data.description : null,
        voiceChatEnabled: typeof data.voiceChatEnabled === "boolean" ? data.voiceChatEnabled : null,
        rootPlaceId,
        socialLinks: social.links,
        socialRaw: social.raw ?? null
      });
    } catch (error) {
      console.warn(`⚠️ Open Cloud universe fetch failed for ${universeId}:`, (error as Error).message);
    }
  });

  return results;
}

async function loadUniverses(limit: number) {
  const supabase = supabaseAdmin();
  let query = supabase
    .from("roblox_games")
    .select("universe_id, root_place_id, last_seen_in_sort, updated_at, name")
    .not("root_place_id", "is", null)
    .order("last_seen_in_sort", { ascending: false });

  if (limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as UniverseRow[]) ?? [];
}

async function fetchGameDetails(universeIds: number[]): Promise<RobloxGameDetail[]> {
  if (!universeIds.length) return [];
  const params = new URLSearchParams();
  params.set("universeIds", universeIds.join(","));
  const data = await fetchJson(`${GAME_DETAILS_API}?${params}`, "game details");
  return Array.isArray(data?.data) ? (data.data as RobloxGameDetail[]) : [];
}

async function fetchGameIcons(universeIds: number[]) {
  if (!universeIds.length) return [];
  const params = new URLSearchParams({
    universeIds: universeIds.join(","),
    size: "512x512",
    format: "Png",
    isCircular: "false"
  });
  const data = (await fetchJson(`${GAME_ICONS_API}?${params}`, "game icons")) as IconResponse;
  return Array.isArray(data?.data) ? data!.data! : [];
}

async function fetchGameThumbnails(universeIds: number[]) {
  if (!universeIds.length) return [];
  const params = new URLSearchParams({
    universeIds: universeIds.join(","),
    size: "768x432",
    format: "Png"
  });
  const data = (await fetchJson(`${GAME_THUMBS_API}?${params}`, "game thumbnails")) as ThumbnailResponse;
  return Array.isArray(data?.data) ? data!.data! : [];
}

async function fetchGamePasses(universeId: number): Promise<GamePass[]> {
  try {
    const data = await fetchJson(PASSES_API(universeId), "game passes");
    return Array.isArray(data?.data) ? (data.data as GamePass[]) : [];
  } catch (error) {
    console.warn(`⚠️ Game passes failed for ${universeId}:`, (error as Error).message);
    return [];
  }
}

async function fetchBadges(universeId: number): Promise<Badge[]> {
  const results: Badge[] = [];
  let cursor: string | null = null;
  try {
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const data = await fetchJson(`${BADGES_API(universeId)}?${params}`, "badges");
      if (Array.isArray(data?.data)) {
        results.push(...(data.data as Badge[]));
      }
      cursor = typeof data?.nextPageCursor === "string" && data.nextPageCursor.length > 0 ? data.nextPageCursor : null;
      if (cursor) await sleep(200);
    } while (cursor);
  } catch (error) {
    console.warn(`⚠️ Badges failed for ${universeId}:`, (error as Error).message);
  }
  return results;
}

function mapGameDetail(
  game: RobloxGameDetail,
  fallbackRootPlaceId?: number | null,
  metadata?: UniverseMetadata
) {
  const votes = game.votes ?? game.pastDayVotes ?? {};
  const stats = {
    playing: game.playing ?? null,
    visits: game.visits ?? null,
    favorites: game.favorites ?? game.favoritedCount ?? null,
    votes: {
      up: votes.upVotes ?? game.totalUpVotes ?? null,
      down: votes.downVotes ?? game.totalDownVotes ?? null
    }
  };

  const rootPlaceId = game.rootPlaceId ?? fallbackRootPlaceId ?? null;
  if (rootPlaceId == null) {
    return null;
  }

  const rawDetails: Record<string, unknown> = { ...game };
  if (metadata?.raw) {
    rawDetails.openCloud = metadata.raw;
  }

  const payload = {
    universe_id: game.id,
    root_place_id: rootPlaceId,
    name: game.name ?? `Universe ${game.id}`,
    description: game.description ?? null,
    source_name: game.sourceName ?? null,
    creator_id: game.creator?.id ?? null,
    creator_name: game.creator?.name ?? null,
    creator_type: game.creator?.type ?? null,
    creator_has_verified_badge: Boolean(game.creator?.hasVerifiedBadge ?? false),
    genre: game.genre ?? null,
    price: game.price ?? null,
    voice_enabled: Boolean(game.voiceEnabled ?? false),
    server_size: game.serverSize ?? null,
    max_players: game.maxPlayers ?? null,
    playing: stats.playing,
    visits: stats.visits,
    favorites: stats.favorites,
    likes: stats.votes.up,
    dislikes: stats.votes.down,
    allowed_gear_categories: Array.isArray(game.allowedGearCategories) ? game.allowedGearCategories : null,
    is_experimental: game.isExperimental ?? null,
    is_genre_enforced: game.isGenreEnforced ?? null,
    is_playable: game.isPlayable ?? null,
    create_vip_servers_allowed: game.createVipServersAllowed ?? null,
    studio_access_allowed: game.studioAccessToApisAllowed ?? null,
    universe_avatar_type: game.universeAvatarType ?? null,
    age_recommendation: game.ageRecommendation ?? null,
    is_sponsored: game.isSponsoredGame ?? null,
    has_verified_badge: game.hasVerifiedBadge ?? null,
    stats,
    raw_details: rawDetails,
    social_links: {},
    raw_social: {}
  };

  if (metadata) {
    if (metadata.displayName) {
      payload.name = metadata.displayName;
    }
    if (metadata.description) {
      payload.description = metadata.description;
    }
    if (typeof metadata.voiceChatEnabled === "boolean") {
      payload.voice_enabled = metadata.voiceChatEnabled;
    }
    if (metadata.socialLinks) {
      payload.social_links = metadata.socialLinks;
      payload.raw_social = metadata.socialRaw ?? { source: "open_cloud", links: metadata.socialLinks };
    }
  }

  return payload;
}

function normalizeThumbnailEntries(thumbnails: ThumbnailResponse["data"]) {
  const map = new Map<
    number,
    Array<{
      url: string;
      state?: string;
      type?: string;
      raw: Record<string, unknown>;
    }>
  >();

  if (!Array.isArray(thumbnails)) return map;
  for (const entry of thumbnails) {
    if (!entry || typeof entry !== "object") continue;
    const list: Array<{ url: string; state?: string; type?: string; raw: any }> = [];
    for (const thumb of entry.thumbnails ?? []) {
      if (!thumb) continue;
      const url = thumb.imageUrl;
      if (!url) continue;
      list.push({
        url,
        state: thumb.state,
        type: thumb.thumbnailType,
        raw: thumb
      });
    }
    map.set(entry.universeId, list);
  }
  return map;
}

function normalizeIconEntries(icons: IconResponse["data"]) {
  const map = new Map<
    number,
    {
      url: string;
      state?: string;
      raw: Record<string, unknown>;
    }
  >();
  if (!Array.isArray(icons)) return map;
  for (const icon of icons) {
    if (!icon) continue;
    const universeId = icon.universeId ?? icon.targetId;
    if (!universeId) continue;
    if (!icon.imageUrl) continue;
    map.set(universeId, { url: icon.imageUrl, state: icon.state, raw: icon });
  }
  return map;
}

async function upsertMedia(
  supabase = supabaseAdmin(),
  universeIds: number[],
  iconEntries: IconResponse["data"],
  thumbnailEntries: ThumbnailResponse["data"]
) {
  if (!universeIds.length) return { mediaRows: 0 };

  const iconMap = normalizeIconEntries(iconEntries);
  const thumbMap = normalizeThumbnailEntries(thumbnailEntries);

  const mediaRows: Array<{
    universe_id: number;
    media_type: "icon" | "thumbnail";
    image_url: string;
    size?: string | null;
    state?: string | null;
    is_primary: boolean;
    extra: Record<string, unknown>;
  }> = [];

  const gameUpdates: Array<{
    universe_id: number;
    icon_url?: string | null;
    thumbnail_urls?: unknown;
    raw_media?: unknown;
  }> = [];

  for (const universeId of universeIds) {
    const icon = iconMap.get(universeId);
    const thumbs = thumbMap.get(universeId) ?? [];

    if (icon) {
      mediaRows.push({
        universe_id: universeId,
        media_type: "icon",
        image_url: icon.url,
        size: "512x512",
        state: icon.state ?? null,
        is_primary: true,
        extra: icon.raw ?? {}
      });
    }

    thumbs.forEach((thumb, index) => {
      mediaRows.push({
        universe_id: universeId,
        media_type: "thumbnail",
        image_url: thumb.url,
        size: "768x432",
        state: thumb.state ?? null,
        is_primary: index === 0,
        extra: thumb.raw ?? {}
      });
    });

    gameUpdates.push({
      universe_id: universeId,
      icon_url: icon?.url ?? null,
      thumbnail_urls: thumbs.map((thumb) => ({
        url: thumb.url,
        state: thumb.state ?? null,
        type: thumb.type ?? null
      })),
      raw_media: {
        icon,
        thumbnails: thumbs
      }
    });
  }

  if (universeIds.length) {
    await supabase.from("roblox_game_media").delete().in("universe_id", universeIds);
  }
  if (mediaRows.length) {
    const { error } = await supabase.from("roblox_game_media").insert(mediaRows);
    if (error) throw error;
  }

  if (gameUpdates.length) {
    await promisePool(gameUpdates, ATTACHMENT_CONCURRENCY, async (update) => {
      const { error } = await supabase
        .from("roblox_games")
        .update({
          icon_url: update.icon_url ?? null,
          thumbnail_urls: update.thumbnail_urls ?? null,
          raw_media: update.raw_media ?? null
        })
        .eq("universe_id", update.universe_id);
      if (error) throw error;
    });
  }

  return { mediaRows: mediaRows.length };
}

async function promisePool<T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>) {
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = handler(item).finally(() => {
      const index = executing.indexOf(p);
      if (index >= 0) executing.splice(index, 1);
    });
    executing.push(p);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.allSettled(executing);
}

async function processAttachments(supabase: ReturnType<typeof supabaseAdmin>, universeIds: number[]) {
  if (!universeIds.length) {
    return { passesCount: 0, badgesCount: 0 };
  }

  const passesByUniverse = new Map<number, GamePass[]>();
  const badgesByUniverse = new Map<number, Badge[]>();

  await promisePool(universeIds, ATTACHMENT_CONCURRENCY, async (universeId) => {
    const [passes, badges] = await Promise.all([fetchGamePasses(universeId), fetchBadges(universeId)]);

    if (passes?.length) {
      passesByUniverse.set(universeId, passes);
    }

    if (badges?.length) {
      badgesByUniverse.set(universeId, badges);
    }
  });

  const passDeletes = Array.from(passesByUniverse.keys());
  if (passDeletes.length) {
    await supabase.from("roblox_game_passes").delete().in("universe_id", passDeletes);
  }
  const passRows: Array<{
    pass_id: number;
    universe_id: number;
    product_id: number | null;
    name: string | null;
    description: string | null;
    price: number | null;
    is_for_sale: boolean | null;
    sales: number | null;
    icon_image_id: number | null;
    icon_image_url: string | null;
    created_at_api: string | null;
    updated_at_api: string | null;
    raw_payload: unknown;
  }> = [];
  for (const [universeId, passes] of passesByUniverse.entries()) {
    for (const pass of passes) {
      passRows.push({
        pass_id: pass.id,
        universe_id: universeId,
        product_id: pass.productId ?? null,
        name: pass.name ?? null,
        description: pass.description ?? null,
        price: pass.price ?? null,
        is_for_sale: typeof pass.isForSale === "boolean" ? pass.isForSale : null,
        sales: pass.sales ?? null,
        icon_image_id: pass.iconImageId ?? pass.displayIconImageId ?? null,
        icon_image_url: null,
        created_at_api: pass.created ?? null,
        updated_at_api: pass.updated ?? null,
        raw_payload: pass
      });
    }
  }
  if (passRows.length) {
    const { error } = await supabase.from("roblox_game_passes").insert(passRows);
    if (error) throw error;
  }

  const badgeDeletes = Array.from(badgesByUniverse.keys());
  if (badgeDeletes.length) {
    await supabase.from("roblox_game_badges").delete().in("universe_id", badgeDeletes);
  }
  const badgeRows: Array<{
    badge_id: number;
    universe_id: number;
    name: string | null;
    description: string | null;
    icon_image_id: number | null;
    icon_image_url: string | null;
    awarding_badge_asset_id: number | null;
    enabled: boolean | null;
    awarded_count: number | null;
    awarded_past_day: number | null;
    awarded_past_week: number | null;
    rarity_percent: number | null;
    stats_updated_at: string | null;
    created_at_api: string | null;
    updated_at_api: string | null;
    raw_payload: unknown;
  }> = [];
  for (const [universeId, badges] of badgesByUniverse.entries()) {
    for (const badge of badges) {
      const stats = badge.statistics ?? {};
      badgeRows.push({
        badge_id: badge.id,
        universe_id: universeId,
        name: badge.name ?? null,
        description: badge.description ?? null,
        icon_image_id: badge.iconImageId ?? badge.displayIconImageId ?? null,
        icon_image_url: null,
        awarding_badge_asset_id: badge.awardingBadgeAssetId ?? null,
        enabled: typeof badge.enabled === "boolean" ? badge.enabled : null,
        awarded_count: stats.awardedCount ?? null,
        awarded_past_day: stats.pastDayAwardedCount ?? null,
        awarded_past_week: stats.pastWeekAwardedCount ?? null,
        rarity_percent: badge.rarity ?? null,
        stats_updated_at: null,
        created_at_api: badge.created ?? null,
        updated_at_api: badge.updated ?? null,
        raw_payload: badge
      });
    }
  }
  if (badgeRows.length) {
    const { error } = await supabase.from("roblox_game_badges").insert(badgeRows);
    if (error) throw error;
  }

  return {
    passesCount: passRows.length,
    badgesCount: badgeRows.length
  };
}

async function processBatch(
  supabase: ReturnType<typeof supabaseAdmin>,
  universes: UniverseRow[]
): Promise<{
  updatedGames: number;
  mediaRows: number;
  socialCount: number;
  passesCount: number;
  badgesCount: number;
}> {
  if (!universes.length) {
    return { updatedGames: 0, mediaRows: 0, socialCount: 0, passesCount: 0, badgesCount: 0 };
  }

  const universeIds = universes.map((u) => u.universe_id);
  const [metadataMap, details] = await Promise.all([fetchUniverseMetadata(universeIds), fetchGameDetails(universeIds)]);
  const rootMap = new Map(universes.map((u) => [u.universe_id, u.root_place_id]));
  for (const [id, meta] of metadataMap.entries()) {
    if (meta.rootPlaceId) {
      rootMap.set(id, meta.rootPlaceId);
    }
  }
  const needsLookup = details
    .filter((detail) => {
      const existing = rootMap.get(detail.id);
      return (detail.rootPlaceId == null || detail.rootPlaceId === 0) && (existing == null || existing === 0);
    })
    .map((detail) => detail.id);

  if (needsLookup.length) {
    const { data, error } = await supabase
      .from("roblox_games")
      .select("universe_id, root_place_id")
      .in("universe_id", needsLookup);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.root_place_id) {
        rootMap.set(row.universe_id, row.root_place_id);
      }
    }
  }

  const missingRootIds: number[] = [];
  let metadataSocialApplied = 0;
  const upsertPayload = details
    .map((detail) => {
      const metadata = metadataMap.get(detail.id);
      const fallbackRoot = rootMap.get(detail.id) ?? null;
      if (fallbackRoot == null && (detail.rootPlaceId == null || detail.rootPlaceId === 0)) {
        missingRootIds.push(detail.id);
        return null;
      }
      const mapped = mapGameDetail(detail, fallbackRoot, metadata);
      if (mapped && metadata?.socialLinks) {
        metadataSocialApplied += 1;
      }
      return mapped;
    })
    .filter((value): value is NonNullable<typeof value> => value != null);
  const skipped = details.length - upsertPayload.length;
  if (skipped > 0) {
    console.warn(
      `⚠️ Skipped ${skipped} universes due to missing root place IDs. Examples: ${missingRootIds.slice(0, 5).join(", ")}`
    );
  }

  if (upsertPayload.length) {
    const { error } = await supabase.from("roblox_games").upsert(upsertPayload, { onConflict: "universe_id" });
    if (error) throw error;
  }

  const processedUniverseIds = upsertPayload.map((payload) => payload.universe_id);

  const [icons, thumbs] = await Promise.all([
    fetchGameIcons(processedUniverseIds),
    fetchGameThumbnails(processedUniverseIds)
  ]);
  const mediaStats = await upsertMedia(supabase, processedUniverseIds, icons, thumbs);

  const attachments = await processAttachments(supabase, processedUniverseIds);

  return {
    updatedGames: upsertPayload.length,
    mediaRows: mediaStats.mediaRows,
    socialCount: metadataSocialApplied,
    passesCount: attachments.passesCount,
    badgesCount: attachments.badgesCount
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | number | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limit" || arg === "-l") {
      options.limit = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--batch" || arg === "-b") {
      options.batch = Number(args[i + 1]);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
Usage: npm run enrich:universes -- [options]

Options:
  -l, --limit <number>   Total universes to process (default: ${DEFAULT_TOTAL_LIMIT})
  -b, --batch <number>   Batch size per Roblox API request (default: ${BATCH_SIZE})
  -h, --help             Show this help text
`);
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const totalLimit =
    typeof options.limit === "number" && !Number.isNaN(options.limit) && options.limit > 0
      ? options.limit
      : DEFAULT_TOTAL_LIMIT;
  const batchSize =
    typeof options.batch === "number" && !Number.isNaN(options.batch) && options.batch > 0 ? options.batch : BATCH_SIZE;

  const supabase = supabaseAdmin();
  const targetUniverses = await loadUniverses(totalLimit);
  if (!targetUniverses.length) {
    console.log("ℹ️ No universes found to enrich.");
    return;
  }

  console.log(
    `🚀 Enriching ${targetUniverses.length} universes (batch size ${batchSize}, concurrency ${ATTACHMENT_CONCURRENCY})`
  );

  let processed = 0;
  for (let i = 0; i < targetUniverses.length; i += batchSize) {
    const chunk = targetUniverses.slice(i, i + batchSize);
    const stats = await processBatch(supabase, chunk);
    processed += chunk.length;
    console.log(
      ` • Batch ${Math.ceil((i + 1) / batchSize)} — universes: ${chunk.length}, updated: ${stats.updatedGames}, media rows: ${stats.mediaRows}, social: ${stats.socialCount}, passes: ${stats.passesCount}, badges: ${stats.badgesCount}`
    );
    await sleep(250);
  }

  console.log(`✅ Finished enriching ${processed} universes.`);
}

main().catch((error) => {
  console.error("❌ Universe enrichment failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
