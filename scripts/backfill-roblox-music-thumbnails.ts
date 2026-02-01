import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase-admin";

const THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const USER_AGENT = "BloxodesMusicThumbnailBot/1.0";

const BATCH_SIZE = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_BATCH, 50, 1, 100);
const MAX_TOTAL = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_MAX_TOTAL, 0, 0, Number.POSITIVE_INFINITY);
const REQUEST_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_DELAY_MS, 150, 0, 10000);
const MAX_RETRIES = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_MAX_RETRIES, 3, 0, 10);
const RETRY_BASE_MS = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_RETRY_BASE_MS, 400, 100, 10000);
const RETRY_JITTER_MS = clampNumber(process.env.ROBLOX_MUSIC_THUMBNAIL_RETRY_JITTER_MS, 200, 0, 5000);
const THUMBNAIL_SIZE = process.env.ROBLOX_MUSIC_THUMBNAIL_SIZE ?? "420x420";
const THUMBNAIL_FORMAT = process.env.ROBLOX_MUSIC_THUMBNAIL_FORMAT ?? "Png";
const DRY_RUN = toBoolean(process.env.ROBLOX_MUSIC_THUMBNAIL_DRY_RUN, false);

const FILTER_SOURCE = process.env.ROBLOX_MUSIC_THUMBNAIL_SOURCE;

const THUMBNAIL_READY_STATE = "Completed";

type ThumbnailEntry = {
  targetId?: number;
  state?: string;
  imageUrl?: string;
};

type MusicRow = {
  asset_id: number;
  source: string | null;
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

function withJitter(ms: number) {
  if (!RETRY_JITTER_MS) return ms;
  return ms + Math.floor(Math.random() * RETRY_JITTER_MS);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<Response> {
  let attempt = 0;
  while (true) {
    await sleep(REQUEST_DELAY_MS);
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
      }
    });

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      return res;
    }

    const backoff = withJitter(RETRY_BASE_MS * Math.pow(2, attempt));
    attempt += 1;
    await sleep(backoff);
  }
}

async function fetchThumbnailBatch(assetIds: number[]): Promise<ThumbnailEntry[]> {
  if (!assetIds.length) return [];
  const params = new URLSearchParams({
    assetIds: assetIds.join(","),
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
  return payload?.data ?? [];
}

async function fetchRows(limit: number): Promise<MusicRow[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_music_ids")
    .select("asset_id,source")
    .is("thumbnail_url", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (FILTER_SOURCE && FILTER_SOURCE.trim().length) {
    query = query.eq("source", FILTER_SOURCE.trim());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load music IDs: ${error.message}`);
  }
  return (data ?? []) as MusicRow[];
}

async function upsertThumbnails(rows: Array<{ asset_id: number; thumbnail_url: string }>) {
  if (!rows.length) return;
  if (DRY_RUN) {
    console.log(`Dry run: would upsert ${rows.length} thumbnails.`);
    return;
  }
  const sb = supabaseAdmin();
  const { error } = await sb.from("roblox_music_ids").upsert(rows, { onConflict: "asset_id" });
  if (error) {
    throw new Error(`Failed to upsert thumbnails: ${error.message}`);
  }
}

function mapThumbnails(assetIds: number[], entries: ThumbnailEntry[]) {
  const map = new Map<number, string>();
  entries.forEach((entry) => {
    if (!entry?.targetId || !entry.imageUrl) return;
    if (entry.state && entry.state !== THUMBNAIL_READY_STATE) return;
    map.set(entry.targetId, entry.imageUrl);
  });

  return assetIds
    .map((assetId) => {
      const url = map.get(assetId);
      if (!url) return null;
      return { asset_id: assetId, thumbnail_url: url };
    })
    .filter((row): row is { asset_id: number; thumbnail_url: string } => row !== null);
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  let processed = 0;
  while (true) {
    if (MAX_TOTAL > 0 && processed >= MAX_TOTAL) break;
    const remaining = MAX_TOTAL > 0 ? Math.max(0, MAX_TOTAL - processed) : BATCH_SIZE;
    const batchSize = Math.min(BATCH_SIZE, remaining || BATCH_SIZE);
    const batch = await fetchRows(batchSize);
    if (!batch.length) break;

    const assetIds = batch.map((row) => row.asset_id);
    const entries = await fetchThumbnailBatch(assetIds);
    const updates = mapThumbnails(assetIds, entries);

    await upsertThumbnails(updates);
    processed += batch.length;
    console.log(`Processed ${processed} music IDs (updated ${updates.length}).`);
  }

  console.log(`Done. Total processed: ${processed}.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
