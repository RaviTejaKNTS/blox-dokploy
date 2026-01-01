import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";

const PRODUCTINFO_API = (assetId: number) => `https://api.roblox.com/marketplace/productinfo?assetId=${assetId}`;
const ASSETDELIVERY_API = (assetId: number) => `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
const USER_AGENT = "BloxodesMusicVerifier/1.0";

const VERIFY_BATCH_SIZE = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_BATCH, 100, 1, 1000);
const VERIFY_MAX_TOTAL = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_MAX_TOTAL, 0, 0, Number.POSITIVE_INFINITY);
const VERIFY_CONCURRENCY = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_CONCURRENCY, 4, 1, 25);
const VERIFY_REFRESH_HOURS = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_REFRESH_HOURS, 168, 0, 365 * 24);
const VERIFY_REQUEST_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_REQUEST_DELAY_MS, 150, 0, 10000);
const VERIFY_BATCH_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_BATCH_DELAY_MS, 500, 0, 60000);
const VERIFY_MAX_RETRIES = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_MAX_RETRIES, 3, 0, 10);
const VERIFY_RETRY_BASE_MS = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_RETRY_BASE_MS, 400, 100, 10000);
const VERIFY_RETRY_JITTER_MS = clampNumber(process.env.ROBLOX_MUSIC_VERIFY_RETRY_JITTER_MS, 200, 0, 5000);
const DRY_RUN = toBoolean(process.env.ROBLOX_MUSIC_VERIFY_DRY_RUN, false);

const SCORE_VOTE_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_VOTE_WEIGHT, 0.7, 0, 100);
const SCORE_UPVOTE_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_UPVOTE_WEIGHT, 10, 0, 1000);
const SCORE_RANK_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RANK_WEIGHT, 1, 0, 100);
const SCORE_RECENCY_WEIGHT = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RECENCY_WEIGHT, 1, 0, 100);
const SCORE_VERIFIED_BONUS = clampNumber(process.env.ROBLOX_MUSIC_SCORE_VERIFIED_BONUS, 50, 0, 1000);
const SCORE_RANK_MAX = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RANK_MAX, 1000, 0, 100000);
const SCORE_RECENCY_MAX_DAYS = clampNumber(process.env.ROBLOX_MUSIC_SCORE_RECENCY_MAX_DAYS, 90, 0, 365);

const AUDIO_ASSET_TYPE_ID = 3;

type MusicRow = {
  asset_id: number;
  rank: number | null;
  raw_payload: Record<string, unknown> | null;
  last_seen_at: string | null;
  verified_at: string | null;
  vote_count: number | null;
  upvote_percent: number | null;
  creator_verified: boolean | null;
};

type VerificationResult = {
  asset_id: number;
  boombox_ready: boolean;
  boombox_ready_reason: string | null;
  verified_at: string;
  asset_delivery_status: number | null;
  popularity_score: number;
  vote_count: number | null;
  upvote_percent: number | null;
  creator_verified: boolean | null;
  product_info_json?: Record<string, unknown> | null;
};

type ProductInfoResult = {
  status: number;
  data: Record<string, unknown> | null;
};

function clampNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
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

function withJitter(ms: number) {
  if (!VERIFY_RETRY_JITTER_MS) return ms;
  return ms + Math.floor(Math.random() * VERIFY_RETRY_JITTER_MS);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(init?.headers ?? {})
      }
    });

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= VERIFY_MAX_RETRIES) {
      return res;
    }

    const backoff = withJitter(VERIFY_RETRY_BASE_MS * Math.pow(2, attempt));
    attempt += 1;
    await sleep(backoff);
  }
}

async function fetchProductInfo(assetId: number): Promise<ProductInfoResult> {
  await sleep(VERIFY_REQUEST_DELAY_MS);
  const res = await fetchWithRetry(PRODUCTINFO_API(assetId));
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch (error) {
    data = null;
  }
  return { status: res.status, data };
}

async function fetchAssetDeliveryStatus(assetId: number): Promise<number | null> {
  await sleep(VERIFY_REQUEST_DELAY_MS);
  const url = ASSETDELIVERY_API(assetId);
  let res = await fetchWithRetry(url, {
    method: "HEAD",
    redirect: "manual"
  });

  if (res.status === 405) {
    res = await fetchWithRetry(url, {
      method: "GET",
      redirect: "manual",
      headers: { Range: "bytes=0-0" }
    });
  }

  return res.status || null;
}

function extractVoting(rawPayload: Record<string, unknown> | null) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      voteCount: null as number | null,
      upvotePercent: null as number | null,
      creatorVerified: null as boolean | null
    };
  }

  const voting = (rawPayload as Record<string, unknown>).voting as Record<string, unknown> | null | undefined;
  const creator = (rawPayload as Record<string, unknown>).creator as Record<string, unknown> | null | undefined;

  const voteCount = normalizeNumber(voting?.voteCount ?? voting?.upVotes ?? voting?.upvotes ?? null);
  const upvotePercent = normalizeNumber(voting?.upVotePercent ?? voting?.upvotePercent ?? null);
  const creatorVerified = normalizeBoolean(creator?.verified ?? creator?.hasVerifiedBadge ?? null);

  return {
    voteCount,
    upvotePercent,
    creatorVerified
  };
}

function computeRecencyScore(when: string | null) {
  if (!when || SCORE_RECENCY_MAX_DAYS <= 0) return 0;
  const date = new Date(when);
  if (!Number.isFinite(date.getTime())) return 0;
  const days = Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, SCORE_RECENCY_MAX_DAYS - days);
}

function computePopularityScore(row: MusicRow, voting: ReturnType<typeof extractVoting>) {
  const voteCount = voting.voteCount ?? row.vote_count ?? 0;
  const upvotePercent = voting.upvotePercent ?? row.upvote_percent ?? 0;
  const creatorVerified = voting.creatorVerified ?? row.creator_verified ?? false;
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

async function verifyRow(row: MusicRow): Promise<VerificationResult> {
  const now = new Date().toISOString();
  const productInfo = await fetchProductInfo(row.asset_id);
  const assetDeliveryStatus = await fetchAssetDeliveryStatus(row.asset_id);
  const voting = extractVoting(row.raw_payload ?? null);

  const assetTypeId = normalizeNumber(productInfo.data?.AssetTypeId ?? productInfo.data?.assetTypeId ?? null);
  const isAudio = assetTypeId === AUDIO_ASSET_TYPE_ID;
  const productInfoOk = productInfo.status >= 200 && productInfo.status < 300 && !!productInfo.data;
  const assetDeliveryOk = assetDeliveryStatus !== null && assetDeliveryStatus >= 200 && assetDeliveryStatus < 400;
  const boomboxReady = productInfoOk && isAudio && assetDeliveryOk;
  const boomboxReason = boomboxReady
    ? null
    : buildBoomboxReason(assetDeliveryStatus, isAudio, productInfoOk);

  const popularityScore = computePopularityScore(row, voting);

  return {
    asset_id: row.asset_id,
    boombox_ready: boomboxReady,
    boombox_ready_reason: boomboxReason,
    verified_at: now,
    asset_delivery_status: assetDeliveryStatus,
    popularity_score: popularityScore,
    vote_count: voting.voteCount ?? row.vote_count ?? null,
    upvote_percent: voting.upvotePercent ?? row.upvote_percent ?? null,
    creator_verified: voting.creatorVerified ?? row.creator_verified ?? null,
    product_info_json: productInfo.data ?? null
  };
}

async function fetchVerificationBatch(limit: number, cutoff: string | null): Promise<MusicRow[]> {
  const supabase = supabaseAdmin();
  let query = supabase
    .from("roblox_music_ids")
    .select("asset_id, rank, raw_payload, last_seen_at, verified_at, vote_count, upvote_percent, creator_verified")
    .order("verified_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (cutoff) {
    query = query.or(`verified_at.is.null,verified_at.lt.${cutoff}`);
  } else {
    query = query.or("verified_at.is.null");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load music IDs: ${error.message}`);
  }

  return (data ?? []) as MusicRow[];
}

async function upsertVerificationRows(rows: VerificationResult[]) {
  if (!rows.length) return;
  const payload = rows.map((row) => {
    const { product_info_json, ...rest } = row;
    const entry: Record<string, unknown> = { ...rest };
    if (product_info_json) {
      entry.product_info_json = product_info_json;
    }
    return entry;
  });

  if (DRY_RUN) {
    console.log(`Dry run: would upsert ${payload.length} rows.`);
    return;
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("roblox_music_ids").upsert(payload, { onConflict: "asset_id" });
  if (error) {
    throw new Error(`Failed to upsert verification results: ${error.message}`);
  }
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const cutoff = VERIFY_REFRESH_HOURS > 0
    ? new Date(Date.now() - VERIFY_REFRESH_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  let processed = 0;
  while (true) {
    if (VERIFY_MAX_TOTAL > 0 && processed >= VERIFY_MAX_TOTAL) break;
    const remaining = VERIFY_MAX_TOTAL > 0 ? Math.max(0, VERIFY_MAX_TOTAL - processed) : VERIFY_BATCH_SIZE;
    const batchSize = Math.min(VERIFY_BATCH_SIZE, remaining || VERIFY_BATCH_SIZE);

    const batch = await fetchVerificationBatch(batchSize, cutoff);
    if (!batch.length) break;

    const results: VerificationResult[] = [];
    for (let i = 0; i < batch.length; i += VERIFY_CONCURRENCY) {
      const slice = batch.slice(i, i + VERIFY_CONCURRENCY);
      const sliceResults = await Promise.all(slice.map((row) => verifyRow(row)));
      results.push(...sliceResults);
    }

    await upsertVerificationRows(results);
    processed += batch.length;
    console.log(`Verified ${processed} music IDs...`);

    await sleep(VERIFY_BATCH_DELAY_MS);
  }

  console.log(`Done. Total verified: ${processed}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
