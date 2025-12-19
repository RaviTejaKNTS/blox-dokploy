import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type RobloxType = "user" | "group" | "experience" | "asset" | "bundle" | "gamepass" | "badge";
type SourceType = "roblox" | "supabase" | "mixed" | "none";

type ResolverResponseOk = {
  ok: true;
  type: RobloxType;
  ids: Record<string, number>;
  openUrl: string;
  details: Record<string, unknown> | null;
  imageUrl?: string | null;
  source: SourceType;
  warnings: string[];
};

type ResolverResponseError = {
  ok: false;
  error: { code: string; message: string; hint?: string };
  warnings?: string[];
};

type DetectResult =
  | { type: "user"; userId: number }
  | { type: "group"; groupId: number }
  | { type: "experience"; placeId?: number | null; universeId?: number | null }
  | { type: "asset"; assetId: number }
  | { type: "bundle"; bundleId: number }
  | { type: "gamepass"; gamePassId: number }
  | { type: "badge"; badgeId: number };

type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; rateLimited: boolean };

type RobloxUser = {
  id?: number;
  name?: string;
  displayName?: string;
  description?: string;
  created?: string;
  isBanned?: boolean;
  hasVerifiedBadge?: boolean;
};

type RobloxGroup = {
  id?: number;
  name?: string;
  description?: string;
  memberCount?: number;
  owner?: {
    userId?: number;
    username?: string;
    displayName?: string;
  };
  hasVerifiedBadge?: boolean;
  isLocked?: boolean;
};

type RobloxGameDetail = {
  id?: number;
  name?: string;
  description?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
  };
  genre?: string;
  price?: number;
  maxPlayers?: number;
  serverSize?: number;
  playing?: number;
  visits?: number;
  favorites?: number;
  rootPlaceId?: number;
  votes?: { upVotes?: number; downVotes?: number };
  totalUpVotes?: number;
  totalDownVotes?: number;
};

type RobloxCatalogItem = {
  id?: number;
  name?: string;
  description?: string;
  itemType?: string | number;
  itemStatus?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
    hasVerifiedBadge?: boolean;
  };
  price?: number;
  lowestPrice?: number;
  favoriteCount?: number;
  buyCount?: number;
  saleLocationType?: string;
  remaining?: number;
  thumbnailUrl?: string;
};

type RobloxGamePass = {
  id?: number;
  name?: string;
  description?: string;
  price?: number;
  isForSale?: boolean;
  sales?: number;
  created?: string;
  updated?: string;
  productId?: number;
  iconImageId?: number;
  displayIconImageId?: number;
};

type RobloxGameIconResponse = {
  data?: Array<{
    targetId?: number;
    imageUrl?: string;
    state?: string;
    universeId?: number;
  }>;
};

type RobloxProductInfo = {
  AssetId?: number;
  ProductId?: number;
  Name?: string;
  Description?: string;
  AssetTypeId?: number;
  Creator?: {
    Id?: number;
    Name?: string;
    CreatorType?: string;
  };
  PriceInRobux?: number;
  LowestPrice?: number;
  IsForSale?: boolean;
  IsLimited?: boolean;
  IsLimitedUnique?: boolean;
  Remaining?: number;
  Sales?: number;
  MinimumMembershipLevel?: number;
  Created?: string;
  Updated?: string;
  IsPublicDomain?: boolean;
  ContentRatingTypeId?: number;
  IconImageAssetId?: number;
};

type RobloxBundleDetails = {
  id?: number;
  name?: string;
  description?: string;
  bundleType?: string;
  creator?: {
    id?: number;
    name?: string;
    type?: string;
  };
  items?: unknown[];
  itemRestrictions?: unknown[];
  isAllowedInExperiences?: boolean;
  avatarType?: string;
  product?: {
    id?: number;
    priceInRobux?: number;
    isForSale?: boolean;
  };
};

type RobloxBadge = {
  id?: number;
  name?: string;
  description?: string;
  enabled?: boolean;
  awardingUniverse?: {
    id?: number;
    name?: string;
    rootPlaceId?: number;
  };
  statistics?: {
    awardedCount?: number;
    pastDayAwardedCount?: number;
    pastWeekAwardedCount?: number;
  };
  created?: string;
  updated?: string;
  iconImageId?: number;
};

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "BloxodesIdExtractor/1.0 (+https://bloxodes.com; contact@bloxodes.com)";

const WARNING_ROBLOX_RATE_LIMIT = "Roblox rate limit reached. Showing cached data where available.";
const WARNING_ROBLOX_UNAVAILABLE = "Roblox API unavailable. Showing cached data where available.";

const UNIVERSE_FIELDS =
  "universe_id, root_place_id, name, description, creator_id, creator_name, creator_type, group_id, group_name, genre, age_rating, max_players, server_size, playing, visits, favorites, likes, dislikes, icon_url, thumbnail_urls, updated_at";
const GROUP_FIELDS = "group_id, name, description, member_count, owner_id, owner_name, has_verified_badge, updated_at";
const GAMEPASS_FIELDS =
  "pass_id, universe_id, name, description, price, is_for_sale, sales, icon_image_url, created_at_api, updated_at_api, roblox_universes (universe_id, name, root_place_id)";
const BADGE_FIELDS =
  "badge_id, universe_id, name, description, icon_image_url, awarding_badge_asset_id, enabled, awarded_count, awarded_past_day, awarded_past_week, created_at_api, updated_at_api, roblox_universes (universe_id, name, root_place_id)";

function isNumeric(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

function toInt(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRobloxUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function getSearchParamInt(searchParams: URLSearchParams, keys: string[]): number | null {
  for (const [key, value] of searchParams.entries()) {
    if (keys.includes(key.toLowerCase())) {
      return toInt(value);
    }
  }
  return null;
}

function extractId(segment?: string | null): number | null {
  if (!segment) return null;
  const match = segment.match(/\d+/);
  return match ? toInt(match[0]) : null;
}

function normalizeType(type: string | null): RobloxType | null {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  const map: Record<string, RobloxType> = {
    user: "user",
    users: "user",
    group: "group",
    groups: "group",
    community: "group",
    communities: "group",
    experience: "experience",
    game: "experience",
    games: "experience",
    place: "experience",
    asset: "asset",
    catalog: "asset",
    bundle: "bundle",
    bundles: "bundle",
    gamepass: "gamepass",
    "game-pass": "gamepass",
    pass: "gamepass",
    "game-passes": "gamepass",
    badge: "badge",
    badges: "badge"
  };
  return map[normalized] ?? null;
}

function detectFromUrl(url: URL): DetectResult | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host.endsWith("roblox.com")) return null;

  const path = url.pathname.split("/").filter(Boolean);
  const first = path[0]?.toLowerCase() ?? "";
  const second = path[1];

  if (first === "users") {
    const userId = extractId(second) ?? getSearchParamInt(url.searchParams, ["userid"]);
    if (userId) return { type: "user", userId };
  }

  if (first === "groups" || first === "communities") {
    const groupId = extractId(second) ?? getSearchParamInt(url.searchParams, ["groupid"]);
    if (groupId) return { type: "group", groupId };
  }

  if (first === "games" || first === "game") {
    const placeId = extractId(second) ?? getSearchParamInt(url.searchParams, ["placeid"]);
    const universeId = getSearchParamInt(url.searchParams, ["universeid"]);
    if (placeId || universeId) return { type: "experience", placeId, universeId };
  }

  if (first === "catalog" || first === "library") {
    const assetId = extractId(second) ?? getSearchParamInt(url.searchParams, ["assetid"]);
    if (assetId) return { type: "asset", assetId };
  }

  if (first === "bundles") {
    const bundleId = extractId(second) ?? getSearchParamInt(url.searchParams, ["bundleid"]);
    if (bundleId) return { type: "bundle", bundleId };
  }

  if (first === "badges") {
    const badgeId = extractId(second) ?? getSearchParamInt(url.searchParams, ["badgeid"]);
    if (badgeId) return { type: "badge", badgeId };
  }

  if (first === "game-pass" || first === "gamepass" || first === "game-passes") {
    const gamePassId = extractId(second) ?? getSearchParamInt(url.searchParams, ["gamepassid", "passid"]);
    if (gamePassId) return { type: "gamepass", gamePassId };
  }

  const placeId = getSearchParamInt(url.searchParams, ["placeid"]);
  const universeId = getSearchParamInt(url.searchParams, ["universeid"]);
  if (placeId || universeId) return { type: "experience", placeId, universeId };

  return null;
}

async function fetchRobloxJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(init?.headers ?? {})
      }
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: text.slice(0, 300),
        rateLimited: res.status === 429
      };
    }
    const data = text ? (JSON.parse(text) as T) : ({} as T);
    return { ok: true, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
      rateLimited: false
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGameIcon(universeId: number): Promise<string | null> {
  const params = new URLSearchParams({
    universeIds: universeId.toString(),
    size: "512x512",
    format: "Png",
    isCircular: "false"
  });
  const res = await fetchRobloxJson<RobloxGameIconResponse>(`https://thumbnails.roblox.com/v1/games/icons?${params}`);
  if (!res.ok) return null;
  return res.data.data?.[0]?.imageUrl ?? null;
}

function addWarning(warnings: string[], message: string) {
  if (!warnings.includes(message)) warnings.push(message);
}

function noteRateLimit(warnings: string[]) {
  addWarning(warnings, WARNING_ROBLOX_RATE_LIMIT);
}

function noteRobloxFailure(warnings: string[], status?: number) {
  if (status === 404) {
    addWarning(warnings, "Roblox did not return data for this ID.");
    return;
  }
  addWarning(warnings, WARNING_ROBLOX_UNAVAILABLE);
}

function removeWarning(warnings: string[], message: string) {
  let index = warnings.indexOf(message);
  while (index !== -1) {
    warnings.splice(index, 1);
    index = warnings.indexOf(message);
  }
}

function stripUnavailableWarning(warnings: string[], details: Record<string, unknown> | null) {
  if (details) {
    removeWarning(warnings, WARNING_ROBLOX_UNAVAILABLE);
  }
}

function cleanDetails(details: Record<string, unknown>): Record<string, unknown> | null {
  const cleaned = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
  return Object.keys(cleaned).length ? cleaned : null;
}

function mergeDetails(
  primary: Record<string, unknown> | null,
  fallback: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return cleanDetails({ ...fallback, ...primary });
}

function sourceFromSet(sources: Set<string>): SourceType {
  if (sources.size === 0) return "none";
  if (sources.size === 1) {
    return sources.has("roblox") ? "roblox" : "supabase";
  }
  return "mixed";
}

async function fetchUniverseFromSupabase(universeId?: number | null, placeId?: number | null) {
  const supabase = supabaseAdmin();
  if (universeId) {
    const { data } = await supabase
      .from("roblox_universes")
      .select(UNIVERSE_FIELDS)
      .eq("universe_id", universeId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (placeId) {
    const { data } = await supabase
      .from("roblox_universes")
      .select(UNIVERSE_FIELDS)
      .eq("root_place_id", placeId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

async function fetchGroupFromSupabase(groupId: number) {
  const supabase = supabaseAdmin();
  const { data } = await supabase.from("roblox_groups").select(GROUP_FIELDS).eq("group_id", groupId).maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function fetchGamePassFromSupabase(passId: number) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("roblox_universe_gamepasses")
    .select(GAMEPASS_FIELDS)
    .eq("pass_id", passId)
    .maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function fetchBadgeFromSupabase(badgeId: number) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("roblox_universe_badges")
    .select(BADGE_FIELDS)
    .eq("badge_id", badgeId)
    .maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

function buildOpenUrlForExperience(placeId?: number | null, universeId?: number | null): string {
  if (placeId) return `https://www.roblox.com/games/${placeId}`;
  if (universeId) return `https://www.roblox.com/games?universeId=${universeId}`;
  return "https://www.roblox.com/discover#/";
}

async function resolveUser(userId: number): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let details: Record<string, unknown> | null = null;

  const res = await fetchRobloxJson<RobloxUser>(`https://users.roblox.com/v1/users/${userId}`);
  if (res.ok) {
    sources.add("roblox");
    details = cleanDetails({
      name: res.data.name,
      displayName: res.data.displayName,
      description: res.data.description,
      created: res.data.created,
      isBanned: res.data.isBanned,
      hasVerifiedBadge: res.data.hasVerifiedBadge
    });
  } else if (res.rateLimited) {
    noteRateLimit(warnings);
  } else {
    noteRobloxFailure(warnings, res.status);
  }

  if (!details) {
    addWarning(warnings, "No user details available for this ID.");
  }

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: "user",
    ids: { userId },
    openUrl: `https://www.roblox.com/users/${userId}/profile`,
    details,
    source: sourceFromSet(sources),
    warnings
  };
}

async function resolveGroup(groupId: number): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let details: Record<string, unknown> | null = null;

  const res = await fetchRobloxJson<RobloxGroup>(`https://groups.roblox.com/v1/groups/${groupId}`);
  if (res.ok) {
    sources.add("roblox");
    details = cleanDetails({
      name: res.data.name,
      description: res.data.description,
      memberCount: res.data.memberCount,
      ownerName: res.data.owner?.displayName ?? res.data.owner?.username,
      ownerId: res.data.owner?.userId,
      hasVerifiedBadge: res.data.hasVerifiedBadge,
      isLocked: res.data.isLocked
    });
  } else if (res.rateLimited) {
    noteRateLimit(warnings);
  } else {
    noteRobloxFailure(warnings, res.status);
  }

  if (!details) {
    const cached = await fetchGroupFromSupabase(groupId);
    if (cached) {
      sources.add("supabase");
      details = cleanDetails({
        name: cached.name,
        description: cached.description,
        memberCount: cached.member_count,
        ownerName: cached.owner_name,
        ownerId: cached.owner_id,
        hasVerifiedBadge: cached.has_verified_badge,
        snapshotUpdatedAt: cached.updated_at
      });
    }
  }

  if (!details) {
    addWarning(warnings, "No group details available for this ID.");
  }

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: "group",
    ids: { groupId },
    openUrl: `https://www.roblox.com/communities/${groupId}`,
    details,
    source: sourceFromSet(sources),
    warnings
  };
}

async function resolveExperience(placeId?: number | null, universeIdHint?: number | null): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let universeId = universeIdHint ?? null;
  let rootPlaceId = placeId ?? null;
  let robloxDetails: RobloxGameDetail | null = null;
  let supabaseDetails: Record<string, unknown> | null = null;
  let imageUrl: string | null = null;

  if (!universeId && placeId) {
    const res = await fetchRobloxJson<{ universeId?: number }>(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );
    if (res.ok && res.data?.universeId) {
      universeId = res.data.universeId;
      sources.add("roblox");
    } else if (res.rateLimited) {
      noteRateLimit(warnings);
    } else {
      noteRobloxFailure(warnings, res.status);
    }
  }

  if (universeId) {
    const res = await fetchRobloxJson<{ data?: RobloxGameDetail[] }>(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );
    if (res.ok) {
      const entry = res.data.data?.[0] ?? null;
      robloxDetails = entry ?? null;
      if (entry) {
        sources.add("roblox");
        rootPlaceId = rootPlaceId ?? entry.rootPlaceId ?? null;
      }
    } else if (res.rateLimited) {
      noteRateLimit(warnings);
    } else {
      noteRobloxFailure(warnings, res.status);
    }
  }

  if (!robloxDetails) {
    supabaseDetails = await fetchUniverseFromSupabase(universeId, placeId ?? null);
    if (supabaseDetails) {
      sources.add("supabase");
      universeId = universeId ?? (supabaseDetails.universe_id as number | null);
      rootPlaceId = rootPlaceId ?? (supabaseDetails.root_place_id as number | null);
      imageUrl = (supabaseDetails.icon_url as string | null) ?? null;
      const thumbnails = supabaseDetails.thumbnail_urls;
      if (!imageUrl && Array.isArray(thumbnails) && thumbnails.length > 0) {
        imageUrl = typeof thumbnails[0] === "string" ? thumbnails[0] : null;
      }
    }
  }

  if (!imageUrl && universeId) {
    imageUrl = await fetchGameIcon(universeId);
  }

  if (!robloxDetails && !supabaseDetails) {
    addWarning(warnings, "No experience details available for this ID.");
  }

  const details = cleanDetails({
    name: robloxDetails?.name ?? supabaseDetails?.name,
    description: robloxDetails?.description ?? supabaseDetails?.description,
    creatorName: robloxDetails?.creator?.name ?? supabaseDetails?.creator_name,
    creatorType: robloxDetails?.creator?.type ?? supabaseDetails?.creator_type,
    creatorId: robloxDetails?.creator?.id ?? supabaseDetails?.creator_id,
    groupName: supabaseDetails?.group_name,
    genre: robloxDetails?.genre ?? supabaseDetails?.genre,
    ageRating: supabaseDetails?.age_rating,
    maxPlayers: robloxDetails?.maxPlayers ?? supabaseDetails?.max_players,
    serverSize: robloxDetails?.serverSize ?? supabaseDetails?.server_size,
    playing: robloxDetails?.playing ?? supabaseDetails?.playing,
    visits: robloxDetails?.visits ?? supabaseDetails?.visits,
    favorites: robloxDetails?.favorites ?? supabaseDetails?.favorites,
    likes: robloxDetails?.votes?.upVotes ?? robloxDetails?.totalUpVotes ?? supabaseDetails?.likes,
    dislikes: robloxDetails?.votes?.downVotes ?? robloxDetails?.totalDownVotes ?? supabaseDetails?.dislikes,
    price: robloxDetails?.price ?? supabaseDetails?.price,
    snapshotUpdatedAt: supabaseDetails?.updated_at
  });

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: "experience",
    ids: (cleanDetails({
      placeId: rootPlaceId ?? placeId ?? undefined,
      universeId: universeId ?? undefined
    }) ?? {}) as Record<string, number>,
    openUrl: buildOpenUrlForExperience(rootPlaceId ?? placeId, universeId),
    details,
    imageUrl,
    source: sourceFromSet(sources),
    warnings
  };
}

async function resolveCatalogItem(itemType: "asset" | "bundle", id: number): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let details: Record<string, unknown> | null = null;
  let imageUrl: string | null = null;

  const itemTypeEnum = itemType === "asset" ? 1 : 2;
  const res = await fetchRobloxJson<{ data?: RobloxCatalogItem[] }>(
    "https://catalog.roblox.com/v1/catalog/items/details",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ itemType: itemTypeEnum, id }] })
    }
  );

  if (res.ok) {
    const entry = res.data.data?.[0] ?? null;
    if (entry) {
      sources.add("roblox");
      details = cleanDetails({
        name: entry.name,
        description: entry.description,
        itemType: entry.itemType,
        itemStatus: entry.itemStatus,
        creatorName: entry.creator?.name,
        creatorType: entry.creator?.type,
        creatorId: entry.creator?.id,
        creatorVerified: entry.creator?.hasVerifiedBadge,
        price: entry.price,
        lowestPrice: entry.lowestPrice,
        favoriteCount: entry.favoriteCount,
        buyCount: entry.buyCount,
        saleLocationType: entry.saleLocationType,
        remaining: entry.remaining
      });
      imageUrl = entry.thumbnailUrl ?? null;
    }
  } else if (res.rateLimited) {
    noteRateLimit(warnings);
  } else {
    noteRobloxFailure(warnings, res.status);
  }

  if (itemType === "asset") {
    if (!details) {
      const economy = await fetchRobloxJson<RobloxProductInfo>(`https://economy.roblox.com/v2/assets/${id}/details`);
      if (economy.ok) {
        sources.add("roblox");
        const economyDetails = cleanDetails({
          name: economy.data.Name,
          description: economy.data.Description,
          assetTypeId: economy.data.AssetTypeId,
          creatorName: economy.data.Creator?.Name,
          creatorType: economy.data.Creator?.CreatorType,
          creatorId: economy.data.Creator?.Id,
          price: economy.data.PriceInRobux,
          lowestPrice: economy.data.LowestPrice,
          isForSale: economy.data.IsForSale,
          isLimited: economy.data.IsLimited,
          isLimitedUnique: economy.data.IsLimitedUnique,
          remaining: economy.data.Remaining,
          sales: economy.data.Sales,
          membershipLevel: economy.data.MinimumMembershipLevel,
          isPublicDomain: economy.data.IsPublicDomain,
          created: economy.data.Created,
          updated: economy.data.Updated,
          productId: economy.data.ProductId
        });
        details = mergeDetails(details, economyDetails);
        if (!imageUrl && economy.data.IconImageAssetId) {
          imageUrl = `https://www.roblox.com/asset-thumbnail/image?assetId=${economy.data.IconImageAssetId}&width=420&height=420&format=png`;
        }
      } else if (economy.rateLimited) {
        noteRateLimit(warnings);
      } else {
        noteRobloxFailure(warnings, economy.status);
      }
    }

    if (!details) {
      const productInfo = await fetchRobloxJson<RobloxProductInfo>(
        `https://api.roblox.com/marketplace/productinfo?assetId=${id}`
      );
      if (productInfo.ok) {
        sources.add("roblox");
        const fallbackDetails = cleanDetails({
          name: productInfo.data.Name,
          description: productInfo.data.Description,
          assetTypeId: productInfo.data.AssetTypeId,
          creatorName: productInfo.data.Creator?.Name,
          creatorType: productInfo.data.Creator?.CreatorType,
          creatorId: productInfo.data.Creator?.Id,
          price: productInfo.data.PriceInRobux,
          lowestPrice: productInfo.data.LowestPrice,
          isForSale: productInfo.data.IsForSale,
          isLimited: productInfo.data.IsLimited,
          isLimitedUnique: productInfo.data.IsLimitedUnique,
          remaining: productInfo.data.Remaining,
          sales: productInfo.data.Sales,
          membershipLevel: productInfo.data.MinimumMembershipLevel,
          isPublicDomain: productInfo.data.IsPublicDomain,
          created: productInfo.data.Created,
          updated: productInfo.data.Updated,
          productId: productInfo.data.ProductId
        });
        details = mergeDetails(details, fallbackDetails);
        if (!imageUrl && productInfo.data.IconImageAssetId) {
          imageUrl = `https://www.roblox.com/asset-thumbnail/image?assetId=${productInfo.data.IconImageAssetId}&width=420&height=420&format=png`;
        }
      } else if (productInfo.rateLimited) {
        noteRateLimit(warnings);
      } else {
        noteRobloxFailure(warnings, productInfo.status);
      }
    }

    if (!imageUrl) {
      const thumbs = await fetchRobloxJson<{ data?: Array<{ imageUrl?: string }> }>(
        `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`
      );
      if (thumbs.ok) {
        sources.add("roblox");
        imageUrl = thumbs.data.data?.[0]?.imageUrl ?? null;
      } else if (thumbs.rateLimited) {
        noteRateLimit(warnings);
      } else {
        noteRobloxFailure(warnings, thumbs.status);
      }
    }
  }

  if (itemType === "bundle") {
    if (!details) {
      const fallback = await fetchRobloxJson<RobloxBundleDetails>(
        `https://catalog.roblox.com/v1/bundles/${id}/details`
      );
      if (fallback.ok) {
        sources.add("roblox");
        const fallbackDetails = cleanDetails({
          name: fallback.data.name,
          description: fallback.data.description,
          bundleType: fallback.data.bundleType,
          creatorName: fallback.data.creator?.name,
          creatorType: fallback.data.creator?.type,
          creatorId: fallback.data.creator?.id,
          itemCount: Array.isArray(fallback.data.items) ? fallback.data.items.length : null,
          itemRestrictions: fallback.data.itemRestrictions,
          isAllowedInExperiences: fallback.data.isAllowedInExperiences,
          avatarType: fallback.data.avatarType,
          productId: fallback.data.product?.id,
          price: fallback.data.product?.priceInRobux,
          isForSale: fallback.data.product?.isForSale
        });
        details = mergeDetails(details, fallbackDetails);
      } else if (fallback.rateLimited) {
        noteRateLimit(warnings);
      } else {
        noteRobloxFailure(warnings, fallback.status);
      }
    }
  }

  if (!details) {
    addWarning(warnings, "No catalog details available for this ID.");
  }

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: itemType,
    ids: itemType === "asset" ? { assetId: id } : { bundleId: id },
    openUrl: itemType === "asset" ? `https://www.roblox.com/catalog/${id}` : `https://www.roblox.com/bundles/${id}`,
    details,
    imageUrl,
    source: sourceFromSet(sources),
    warnings
  };
}

async function resolveGamePass(gamePassId: number): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let details: Record<string, unknown> | null = null;
  let imageUrl: string | null = null;

  const res = await fetchRobloxJson<RobloxGamePass>(`https://economy.roblox.com/v1/game-passes/${gamePassId}/details`);
  if (res.ok) {
    sources.add("roblox");
    details = cleanDetails({
      name: res.data.name,
      description: res.data.description,
      price: res.data.price,
      isForSale: res.data.isForSale,
      sales: res.data.sales,
      created: res.data.created,
      updated: res.data.updated,
      productId: res.data.productId
    });
  } else if (res.rateLimited) {
    noteRateLimit(warnings);
  } else {
    noteRobloxFailure(warnings, res.status);
  }

  if (!details) {
    const cached = await fetchGamePassFromSupabase(gamePassId);
    if (cached) {
      sources.add("supabase");
      details = cleanDetails({
        name: cached.name,
        description: cached.description,
        price: cached.price,
        isForSale: cached.is_for_sale,
        sales: cached.sales,
        universeId: cached.universe_id,
        universeName: (cached.roblox_universes as { name?: string } | null)?.name,
        snapshotUpdatedAt: cached.updated_at_api
      });
      imageUrl = (cached.icon_image_url as string | null) ?? null;
    }
  }

  if (!details) {
    addWarning(warnings, "No game pass details available for this ID.");
  }

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: "gamepass",
    ids: { gamePassId },
    openUrl: `https://www.roblox.com/game-pass/${gamePassId}`,
    details,
    imageUrl,
    source: sourceFromSet(sources),
    warnings
  };
}

async function resolveBadge(badgeId: number): Promise<ResolverResponseOk> {
  const warnings: string[] = [];
  const sources = new Set<string>();
  let details: Record<string, unknown> | null = null;
  let imageUrl: string | null = null;

  const res = await fetchRobloxJson<RobloxBadge>(`https://badges.roblox.com/v1/badges/${badgeId}`);
  if (res.ok) {
    sources.add("roblox");
    details = cleanDetails({
      name: res.data.name,
      description: res.data.description,
      enabled: res.data.enabled,
      awardedCount: res.data.statistics?.awardedCount,
      awardedPastDay: res.data.statistics?.pastDayAwardedCount,
      awardedPastWeek: res.data.statistics?.pastWeekAwardedCount,
      created: res.data.created,
      updated: res.data.updated,
      universeId: res.data.awardingUniverse?.id,
      universeName: res.data.awardingUniverse?.name,
      rootPlaceId: res.data.awardingUniverse?.rootPlaceId
    });
    if (res.data.iconImageId) {
      imageUrl = `https://www.roblox.com/asset-thumbnail/image?assetId=${res.data.iconImageId}&width=420&height=420&format=png`;
    }
  } else if (res.rateLimited) {
    noteRateLimit(warnings);
  } else {
    noteRobloxFailure(warnings, res.status);
  }

  if (!details) {
    const cached = await fetchBadgeFromSupabase(badgeId);
    if (cached) {
      sources.add("supabase");
      details = cleanDetails({
        name: cached.name,
        description: cached.description,
        enabled: cached.enabled,
        awardedCount: cached.awarded_count,
        awardedPastDay: cached.awarded_past_day,
        awardedPastWeek: cached.awarded_past_week,
        universeId: cached.universe_id,
        universeName: (cached.roblox_universes as { name?: string } | null)?.name,
        rootPlaceId: (cached.roblox_universes as { root_place_id?: number } | null)?.root_place_id,
        snapshotUpdatedAt: cached.updated_at_api
      });
      imageUrl = (cached.icon_image_url as string | null) ?? null;
    }
  }

  if (!details) {
    addWarning(warnings, "No badge details available for this ID.");
  }

  stripUnavailableWarning(warnings, details);

  return {
    ok: true,
    type: "badge",
    ids: { badgeId },
    openUrl: `https://www.roblox.com/badges/${badgeId}`,
    details,
    imageUrl,
    source: sourceFromSet(sources),
    warnings
  };
}

async function guessFromSupabase(id: number): Promise<{ detected: DetectResult | null; ambiguous: string[] }> {
  const supabase = supabaseAdmin();
  const [universeRes, gamepassRes, groupRes, badgeRes] = await Promise.all([
    supabase
      .from("roblox_universes")
      .select("universe_id, root_place_id")
      .or(`universe_id.eq.${id},root_place_id.eq.${id}`)
      .limit(2),
    supabase.from("roblox_universe_gamepasses").select("pass_id").eq("pass_id", id).maybeSingle(),
    supabase.from("roblox_groups").select("group_id").eq("group_id", id).maybeSingle(),
    supabase.from("roblox_universe_badges").select("badge_id").eq("badge_id", id).maybeSingle()
  ]);

  const matches: string[] = [];
  if (Array.isArray(universeRes.data) && universeRes.data.length > 0) matches.push("experience");
  if (gamepassRes.data) matches.push("gamepass");
  if (groupRes.data) matches.push("group");
  if (badgeRes.data) matches.push("badge");

  if (matches.length === 1) {
    if (matches[0] === "experience") {
      const entry = Array.isArray(universeRes.data) ? universeRes.data[0] : null;
      return {
        detected: {
          type: "experience",
          placeId: entry?.root_place_id ?? id,
          universeId: entry?.universe_id ?? null
        },
        ambiguous: []
      };
    }
    if (matches[0] === "gamepass") return { detected: { type: "gamepass", gamePassId: id }, ambiguous: [] };
    if (matches[0] === "group") return { detected: { type: "group", groupId: id }, ambiguous: [] };
    if (matches[0] === "badge") return { detected: { type: "badge", badgeId: id }, ambiguous: [] };
  }

  return { detected: null, ambiguous: matches };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("q") ?? "").trim();
  if (!raw) {
    return NextResponse.json<ResolverResponseError>(
      { ok: false, error: { code: "MISSING_INPUT", message: "Paste a Roblox link or ID." } },
      { status: 400 }
    );
  }

  const typeHint = normalizeType(searchParams.get("type"));
  let detected: DetectResult | null = null;
  let numericInput = false;

  if (isNumeric(raw)) {
    numericInput = true;
    const id = toInt(raw);
    if (!id) {
      return NextResponse.json<ResolverResponseError>(
        { ok: false, error: { code: "INVALID_ID", message: "Enter a valid numeric Roblox ID." } },
        { status: 400 }
      );
    }
    if (typeHint) {
      switch (typeHint) {
        case "user":
          detected = { type: "user", userId: id };
          break;
        case "group":
          detected = { type: "group", groupId: id };
          break;
        case "experience":
          detected = { type: "experience", placeId: id };
          break;
        case "asset":
          detected = { type: "asset", assetId: id };
          break;
        case "bundle":
          detected = { type: "bundle", bundleId: id };
          break;
        case "gamepass":
          detected = { type: "gamepass", gamePassId: id };
          break;
        case "badge":
          detected = { type: "badge", badgeId: id };
          break;
      }
    } else {
      const guessed = await guessFromSupabase(id);
      if (guessed.ambiguous.length > 1) {
        return NextResponse.json<ResolverResponseError>(
          {
            ok: false,
            error: {
              code: "AMBIGUOUS_ID",
              message: "This ID matches multiple types in our cache.",
              hint: "Paste the full Roblox URL to auto-detect the type."
            }
          },
          { status: 400 }
        );
      }
      detected = guessed.detected;
    }
  } else {
    const url = parseRobloxUrl(raw);
    if (!url) {
      return NextResponse.json<ResolverResponseError>(
        {
          ok: false,
          error: { code: "INVALID_URL", message: "Enter a valid Roblox URL or a numeric ID." }
        },
        { status: 400 }
      );
    }
    detected = detectFromUrl(url);
  }

  if (!detected) {
    return NextResponse.json<ResolverResponseError>(
      {
        ok: false,
        error: {
          code: "UNSUPPORTED_INPUT",
          message: numericInput
            ? "Could not auto-detect this numeric ID."
            : "Could not detect a supported Roblox link.",
          hint: "Paste a full Roblox URL for best detection."
        }
      },
      { status: 400 }
    );
  }

  switch (detected.type) {
    case "user":
      return NextResponse.json(await resolveUser(detected.userId));
    case "group":
      return NextResponse.json(await resolveGroup(detected.groupId));
    case "experience":
      return NextResponse.json(await resolveExperience(detected.placeId, detected.universeId));
    case "asset":
      return NextResponse.json(await resolveCatalogItem("asset", detected.assetId));
    case "bundle":
      return NextResponse.json(await resolveCatalogItem("bundle", detected.bundleId));
    case "gamepass":
      return NextResponse.json(await resolveGamePass(detected.gamePassId));
    case "badge":
      return NextResponse.json(await resolveBadge(detected.badgeId));
  }
}
