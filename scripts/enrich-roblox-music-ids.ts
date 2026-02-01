import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase-admin";

const PRODUCTINFO_API = (assetId: number) => `https://api.roblox.com/marketplace/productinfo?assetId=${assetId}`;
const ECONOMY_DETAILS_API = (assetId: number) => `https://economy.roblox.com/v2/assets/${assetId}/details`;
const TOOLBOX_ASSET_API = (assetId: number) => `https://apis.roblox.com/toolbox-service/v2/assets/${assetId}`;
const ASSETDELIVERY_API = (assetId: number) => `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
const THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";

const USER_AGENT = "BloxodesMusicEnricher/1.0";

const ENRICH_BATCH = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_BATCH, 50, 1, 200);
const ENRICH_MAX_TOTAL = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_MAX_TOTAL, 0, 0, Number.POSITIVE_INFINITY);
const ENRICH_CONCURRENCY = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_CONCURRENCY, 4, 1, 25);
const ENRICH_REFRESH_HOURS = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_REFRESH_HOURS, 168, 0, 365 * 24);
const ENRICH_FORCE = toBoolean(process.env.ROBLOX_MUSIC_ENRICH_FORCE, true);
const ENRICH_SOURCE = process.env.ROBLOX_MUSIC_ENRICH_SOURCE;
const ENRICH_REQUEST_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_REQUEST_DELAY_MS, 150, 0, 10000);
const ENRICH_BATCH_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_BATCH_DELAY_MS, 300, 0, 60000);
const ENRICH_MAX_RETRIES = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_MAX_RETRIES, 3, 0, 10);
const ENRICH_RETRY_BASE_MS = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_RETRY_BASE_MS, 400, 100, 10000);
const ENRICH_RETRY_JITTER_MS = clampNumber(process.env.ROBLOX_MUSIC_ENRICH_RETRY_JITTER_MS, 200, 0, 5000);

const THUMBNAIL_BATCH = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_BATCH, 50, 1, 100);
const THUMBNAIL_SIZE = process.env.ROBLOX_MUSIC_THUMBNAIL_SIZE ?? "420x420";
const THUMBNAIL_FORMAT = process.env.ROBLOX_MUSIC_THUMBNAIL_FORMAT ?? "Png";

const SCORE_VOTE_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_VOTE_WEIGHT, 0.7, 0, 100);
const SCORE_UPVOTE_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_UPVOTE_WEIGHT, 10, 0, 1000);
const SCORE_RANK_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RANK_WEIGHT, 1, 0, 100);
const SCORE_RECENCY_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RECENCY_WEIGHT, 1, 0, 100);
const SCORE_VERIFIED_BONUS = clampNumber(process.env.ROBLOX_MUSIC_SCORE_VERIFIED_BONUS, 50, 0, 1000);
const SCORE_RANK_MAX = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RANK_MAX, 1000, 0, 100000);
const SCORE_RECENCY_MAX_DAYS = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RECENCY_MAX_DAYS, 90, 0, 365);

const AUDIO_ASSET_TYPE_ID = 3;
const UNKNOWN_TITLE = "Unknown Title";
const UNKNOWN_ARTIST = "Unknown Artist";

const THUMBNAIL_READY_STATE = "Completed";

type MusicRow = {
  asset_id: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  thumbnail_url: string | null;
  rank: number | null;
  raw_payload: Record<string, unknown> | null;
  last_seen_at: string | null;
  verified_at: string | null;
  vote_count: number | null;
  upvote_percent: number | null;
  creator_verified: boolean | null;
};

type EnrichUpdate = {
  asset_id: number;
  title?: string;
  artist?: string;
  album?: string | null;
  genre?: string | null;
  duration_seconds?: number | null;
  album_art_asset_id?: number | null;
  thumbnail_url?: string | null;
  product_info_json?: Record<string, unknown> | null;
  asset_delivery_status?: number | null;
  boombox_ready?: boolean;
  boombox_ready_reason?: string | null;
  verified_at?: string;
  vote_count?: number | null;
  upvote_percent?: number | null;
  creator_verified?: boolean | null;
  popularity_score?: number;
  raw_payload?: Record<string, unknown> | null;
};

type ThumbnailEntry = {
  targetId?: number;
  state?: string;
  imageUrl?: string;
};

type FetchJsonResult = {
  status: number;
  data: Record<string, unknown> | null;
  error?: string | null;
};

type AssetDeliveryResult = {
  status: number | null;
  error?: string | null;
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

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function isUnknown(value: string | null, placeholder: string): boolean {
  if (!value) return true;
  return value.trim().toLowerCase() === placeholder.toLowerCase();
}

function pickText(force: boolean, current: string | null, candidates: Array<string | null | undefined>): string | null {
  const candidate = candidates.find((value) => typeof value === "string" && value.trim().length) ?? null;
  if (!candidate) return null;
  if (force || isUnknown(current, UNKNOWN_TITLE) || isUnknown(current, UNKNOWN_ARTIST) || !current) {
    return candidate.trim();
  }
  return null;
}

function pickNumber(force: boolean, current: number | null, candidate: number | null): number | null {
  if (candidate === null || !Number.isFinite(candidate)) return null;
  if (force || current === null || !Number.isFinite(current)) return candidate;
  return null;
}

function withJitter(ms: number) {
  if (!ENRICH_RETRY_JITTER_MS) return ms;
  return ms + Math.floor(Math.random() * ENRICH_RETRY_JITTER_MS);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      await sleep(ENRICH_REQUEST_DELAY_MS);
      const res = await fetch(url, {
        ...init,
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT,
          ...(init?.headers ?? {})
        }
      });

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= ENRICH_MAX_RETRIES) {
        return res;
      }

      const backoff = withJitter(ENRICH_RETRY_BASE_MS * Math.pow(2, attempt));
      attempt += 1;
      await sleep(backoff);
    } catch (error) {
      if (attempt >= ENRICH_MAX_RETRIES) {
        throw error;
      }
      const backoff = withJitter(ENRICH_RETRY_BASE_MS * Math.pow(2, attempt));
      attempt += 1;
      await sleep(backoff);
    }
  }
}

async function fetchJson(url: string): Promise<FetchJsonResult> {
  try {
    const res = await fetchWithRetry(url);
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch (error) {
      data = null;
    }
    return { status: res.status, data, error: null };
  } catch (error) {
    return { status: 0, data: null, error: getErrorMessage(error) };
  }
}

async function fetchAssetDeliveryStatus(assetId: number): Promise<AssetDeliveryResult> {
  try {
    const url = ASSETDELIVERY_API(assetId);
    let res = await fetchWithRetry(url, { method: "HEAD", redirect: "manual" });

    if (res.status === 405) {
      res = await fetchWithRetry(url, {
        method: "GET",
        redirect: "manual",
        headers: { Range: "bytes=0-0" }
      });
    }

    return { status: res.status || null, error: null };
  } catch (error) {
    return { status: null, error: getErrorMessage(error) };
  }
}

async function fetchThumbnails(assetIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (let i = 0; i < assetIds.length; i += THUMBNAIL_BATCH) {
    const chunk = assetIds.slice(i, i + THUMBNAIL_BATCH);
    const params = new URLSearchParams({
      assetIds: chunk.join(","),
      size: THUMBNAIL_SIZE,
      format: THUMBNAIL_FORMAT,
      isCircular: "false"
    });
    const url = `${THUMBNAILS_API}?${params.toString()}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to fetch thumbnails (${res.status}): ${body.slice(0, 200)}`);
    }
    const payload = (await res.json().catch(() => null)) as { data?: ThumbnailEntry[] } | null;
    for (const entry of payload?.data ?? []) {
      if (!entry?.targetId || !entry.imageUrl) continue;
      if (entry.state && entry.state !== THUMBNAIL_READY_STATE) continue;
      map.set(entry.targetId, entry.imageUrl);
    }
  }
  return map;
}

function computeRecencyScore(when: string | null) {
  if (!when || SCORE_RECENCY_MAX_DAYS <= 0) return 0;
  const date = new Date(when);
  if (!Number.isFinite(date.getTime())) return 0;
  const days = Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, SCORE_RECENCY_MAX_DAYS - days);
}

function computePopularityScore(row: MusicRow, voteCount: number, upvotePercent: number, creatorVerified: boolean) {
  const rank = typeof row.rank === "number" && Number.isFinite(row.rank) ? row.rank : null;
  const rankScore = rank ? Math.max(0, SCORE_RANK_MAX - rank) : 0;
  const recencyScore = computeRecencyScore(row.last_seen_at ?? row.verified_at ?? null);

  const baseScore = voteCount * SCORE_VOTE_WEIGHT + upvotePercent * SCORE_UPVOTE_WEIGHT;
  const rankBoost = rankScore * SCORE_RANK_WEIGHT;
  const recencyBoost = recencyScore * SCORE_RECENCY_WEIGHT;
  const verifiedBoost = creatorVerified ? SCORE_VERIFIED_BONUS : 0;
  return baseScore + rankBoost + recencyBoost + verifiedBoost;
}

function buildBoomboxReason(assetDeliveryStatus: number | null, isAudio: boolean, productInfoOk: boolean) {
  if (!productInfoOk) return "productinfo_unavailable";
  if (!isAudio) return "not_audio_asset";
  if (assetDeliveryStatus === 403) return "assetdelivery_forbidden";
  if (assetDeliveryStatus === 404) return "assetdelivery_not_found";
  if (assetDeliveryStatus && assetDeliveryStatus >= 400) return `assetdelivery_${assetDeliveryStatus}`;
  return "assetdelivery_unavailable";
}

function mergeRawPayload(existing: Record<string, unknown> | null, enrichment: Record<string, unknown>) {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  return {
    ...base,
    enrichment
  } as Record<string, unknown>;
}

async function enrichRow(row: MusicRow, thumbnails: Map<number, string>): Promise<EnrichUpdate> {
  const now = new Date().toISOString();
  const [productInfo, economyDetails, toolboxAsset, assetDeliveryResult] = await Promise.all([
    fetchJson(PRODUCTINFO_API(row.asset_id)),
    fetchJson(ECONOMY_DETAILS_API(row.asset_id)),
    fetchJson(TOOLBOX_ASSET_API(row.asset_id)),
    fetchAssetDeliveryStatus(row.asset_id)
  ]);

  const assetDeliveryStatus = assetDeliveryResult.status;
  const productInfoData = (productInfo.data ?? {}) as Record<string, unknown>;
  const economyDetailsData = (economyDetails.data ?? {}) as Record<string, unknown>;
  const toolboxAssetData = (toolboxAsset.data ?? {}) as Record<string, unknown>;
  const assetDetails = (toolboxAssetData["asset"] as Record<string, unknown> | null) ?? null;
  const creatorDetails = (toolboxAssetData["creator"] as Record<string, unknown> | null) ?? null;
  const votingDetails = (toolboxAssetData["voting"] as Record<string, unknown> | null) ?? null;
  const productCreator = (productInfoData["Creator"] as Record<string, unknown> | null) ?? null;
  const economyCreator = (economyDetailsData["Creator"] as Record<string, unknown> | null) ?? null;

  const assetTypeId =
    normalizeNumber(productInfo.data?.AssetTypeId ?? productInfo.data?.assetTypeId ?? null) ??
    normalizeNumber(economyDetails.data?.AssetTypeId ?? economyDetails.data?.assetTypeId ?? null) ??
    normalizeNumber(assetDetails?.assetTypeId ?? assetDetails?.AssetTypeId ?? null);

  const isAudio = assetTypeId === AUDIO_ASSET_TYPE_ID;
  const productInfoOk = productInfo.status >= 200 && productInfo.status < 300 && !!productInfo.data;
  const assetDeliveryOk = assetDeliveryStatus !== null && assetDeliveryStatus >= 200 && assetDeliveryStatus < 400;
  const boomboxReady = productInfoOk && isAudio && assetDeliveryOk;
  const boomboxReason = boomboxReady
    ? null
    : buildBoomboxReason(assetDeliveryStatus, isAudio, productInfoOk);

  const titleCandidate = pickText(ENRICH_FORCE, row.title, [
    normalizeText(assetDetails?.title),
    normalizeText(assetDetails?.name),
    normalizeText(productInfoData["Name"]),
    normalizeText(economyDetailsData["Name"])
  ]);

  const artistCandidate = pickText(ENRICH_FORCE, row.artist, [
    normalizeText(assetDetails?.artist),
    normalizeText(productCreator?.["Name"]),
    normalizeText(economyCreator?.["Name"])
  ]);

  const albumCandidate = pickText(ENRICH_FORCE, row.album, [normalizeText(assetDetails?.album)]);
  const genreCandidate = pickText(ENRICH_FORCE, row.genre, [normalizeText(assetDetails?.genre)]);

  const durationCandidate = pickNumber(
    ENRICH_FORCE,
    row.duration_seconds,
    normalizeNumber(assetDetails?.durationSeconds)
  );

  const previewAssets = (assetDetails?.previewAssets as Record<string, unknown> | null) ?? null;
  const imagePreviewAssets = previewAssets?.["imagePreviewAssets"];
  const previewId = normalizeNumber(Array.isArray(imagePreviewAssets) ? imagePreviewAssets[0] : null);

  const thumbnailUrl = thumbnails.get(row.asset_id) ?? null;

  const voteCount = normalizeNumber(votingDetails?.voteCount ?? votingDetails?.upVotes ?? null) ?? row.vote_count ?? 0;
  const upvotePercent = normalizeNumber(votingDetails?.upVotePercent ?? votingDetails?.upvotePercent ?? null) ??
    row.upvote_percent ??
    0;
  const creatorVerified = normalizeBoolean(creatorDetails?.verified ?? creatorDetails?.hasVerifiedBadge ?? null) ??
    row.creator_verified ??
    false;

  const popularityScore = computePopularityScore(row, voteCount, upvotePercent, creatorVerified);

  const enrichmentPayload = {
    productInfo: productInfo.data ?? null,
    economyDetails: economyDetails.data ?? null,
    toolboxAsset: toolboxAsset.data ?? null,
    thumbnailUrl,
    assetDeliveryStatus,
    errors: {
      ...(productInfo.error ? { productInfo: productInfo.error } : {}),
      ...(economyDetails.error ? { economyDetails: economyDetails.error } : {}),
      ...(toolboxAsset.error ? { toolboxAsset: toolboxAsset.error } : {}),
      ...(assetDeliveryResult.error ? { assetDelivery: assetDeliveryResult.error } : {})
    },
    enrichedAt: now
  };

  const update: EnrichUpdate = {
    asset_id: row.asset_id,
    product_info_json: productInfo.data ?? null,
    asset_delivery_status: assetDeliveryStatus,
    boombox_ready: boomboxReady,
    boombox_ready_reason: boomboxReason,
    verified_at: now,
    vote_count: voteCount || null,
    upvote_percent: upvotePercent || null,
    creator_verified: creatorVerified || null,
    popularity_score: popularityScore,
    raw_payload: mergeRawPayload(row.raw_payload, enrichmentPayload)
  };

  const resolvedTitle = titleCandidate ?? row.title ?? UNKNOWN_TITLE;
  const resolvedArtist = artistCandidate ?? row.artist ?? UNKNOWN_ARTIST;

  update.title = resolvedTitle;
  update.artist = resolvedArtist;
  if (albumCandidate !== null) update.album = albumCandidate;
  if (genreCandidate !== null) update.genre = genreCandidate;
  if (durationCandidate !== null) update.duration_seconds = durationCandidate;
  if (previewId !== null && (ENRICH_FORCE || row.album_art_asset_id === null)) {
    update.album_art_asset_id = previewId;
  }
  if (thumbnailUrl && (ENRICH_FORCE || !row.thumbnail_url)) {
    update.thumbnail_url = thumbnailUrl;
  }

  return update;
}

async function fetchBatch(limit: number, cutoff: string | null): Promise<MusicRow[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_music_ids")
    .select(
      "asset_id,title,artist,album,genre,duration_seconds,album_art_asset_id,thumbnail_url,rank,raw_payload,last_seen_at,verified_at,vote_count,upvote_percent,creator_verified,source"
    )
    .order("verified_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (cutoff) {
    query = query.or(`verified_at.is.null,verified_at.lt.${cutoff}`);
  }

  if (ENRICH_SOURCE && ENRICH_SOURCE.trim().length) {
    query = query.eq("source", ENRICH_SOURCE.trim());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load music IDs: ${error.message}`);
  }

  return (data ?? []) as MusicRow[];
}

async function upsertRows(rows: EnrichUpdate[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  const { error } = await sb.from("roblox_music_ids").upsert(rows, { onConflict: "asset_id" });
  if (error) {
    throw new Error(`Failed to upsert music IDs: ${error.message}`);
  }
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const cutoff = ENRICH_REFRESH_HOURS > 0
    ? new Date(Date.now() - ENRICH_REFRESH_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  let processed = 0;
  while (true) {
    if (ENRICH_MAX_TOTAL > 0 && processed >= ENRICH_MAX_TOTAL) break;
    const remaining = ENRICH_MAX_TOTAL > 0 ? Math.max(0, ENRICH_MAX_TOTAL - processed) : ENRICH_BATCH;
    const batchSize = Math.min(ENRICH_BATCH, remaining || ENRICH_BATCH);

    const batch = await fetchBatch(batchSize, cutoff);
    if (!batch.length) break;

    let thumbnails = new Map<number, string>();
    try {
      thumbnails = await fetchThumbnails(batch.map((row) => row.asset_id));
    } catch (error) {
      console.error(`Thumbnail fetch failed: ${getErrorMessage(error)}`);
    }

    const updates: EnrichUpdate[] = [];
    for (let i = 0; i < batch.length; i += ENRICH_CONCURRENCY) {
      const slice = batch.slice(i, i + ENRICH_CONCURRENCY);
      const sliceUpdates = await Promise.all(
        slice.map(async (row) => {
          try {
            return await enrichRow(row, thumbnails);
          } catch (error) {
            const now = new Date().toISOString();
            console.error(`Failed to enrich ${row.asset_id}: ${getErrorMessage(error)}`);
            return {
              asset_id: row.asset_id,
              verified_at: now,
              boombox_ready: false,
              boombox_ready_reason: "enrich_error",
              raw_payload: mergeRawPayload(row.raw_payload, {
                enrichmentError: getErrorMessage(error),
                enrichedAt: now
              })
            };
          }
        })
      );
      updates.push(...sliceUpdates);
    }

    await upsertRows(updates);
    processed += batch.length;
    console.log(`Enriched ${processed} music IDs...`);

    await sleep(ENRICH_BATCH_DELAY_MS);
  }

  console.log(`Done. Total enriched: ${processed}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
