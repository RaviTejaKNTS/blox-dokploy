import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase-admin";

const ECONOMY_DETAILS_API = (assetId: number) => `https://economy.roblox.com/v2/assets/${assetId}/details`;
const THUMBNAILS_API = "https://thumbnails.roblox.com/v1/assets";
const USER_AGENT = "BloxodesCatalogBot/1.0";

const ENRICH_LIMIT = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_LIMIT ?? "200")));
const ENRICH_MAX_TOTAL = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_MAX_TOTAL ?? "0")));
const ENRICH_BATCH = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_BATCH ?? "100")));
const ENRICH_CONCURRENCY = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_CONCURRENCY ?? "4")));
const THUMBNAIL_BATCH = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_THUMBNAIL_BATCH ?? "50")));
const THUMBNAIL_SIZE = process.env.ROBLOX_CATALOG_THUMBNAIL_SIZE ?? "420x420";
const THUMBNAIL_FORMAT = process.env.ROBLOX_CATALOG_THUMBNAIL_FORMAT ?? "Png";
const MAX_RETRIES = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_MAX_RETRIES ?? "3")));
const REQUEST_MIN_INTERVAL_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_MIN_REQUEST_MS ?? "250")));
const REQUEST_MAX_INTERVAL_MS = Math.max(
  REQUEST_MIN_INTERVAL_MS,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_MAX_REQUEST_MS ?? "2000"))
);
const BATCH_DELAY_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_BATCH_DELAY_MS ?? "500")));
const RETRY_BASE_MS = Math.max(100, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RETRY_BASE_MS ?? "750")));
const RETRY_JITTER_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RETRY_JITTER_MS ?? "250")));
const THUMBNAIL_DELAY_MS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_THUMBNAIL_DELAY_MS ?? "150")));
const RATE_LIMIT_COOLDOWN_MS = Math.max(
  0,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RATE_LIMIT_COOLDOWN_MS ?? "5000"))
);
const RATE_LIMIT_MAX_COOLDOWN_MS = Math.max(
  RATE_LIMIT_COOLDOWN_MS,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RATE_LIMIT_MAX_COOLDOWN_MS ?? "60000"))
);
const RATE_LIMIT_RETRY_LIMIT = Math.max(
  0,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RATE_LIMIT_RETRY_LIMIT ?? "2"))
);
const RATE_LIMIT_REQUEUE_MINUTES = Math.max(
  1,
  Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_RATE_LIMIT_REQUEUE_MINUTES ?? "15"))
);
const LOG_LEVEL = (process.env.ROBLOX_CATALOG_ENRICH_LOG_LEVEL ?? "info").toLowerCase();
const MAX_ERROR_LOGS = Math.max(0, Math.floor(Number(process.env.ROBLOX_CATALOG_ENRICH_MAX_ERROR_LOGS ?? "5")));

const SAFE_MODE_STRIKES = Math.max(1, Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_STRIKES ?? "3")));
const SAFE_MODE_MIN_REQUEST_MS = Math.max(
  0,
  Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_MIN_REQUEST_MS ?? "1500"))
);
const SAFE_MODE_MAX_REQUEST_MS = Math.max(
  SAFE_MODE_MIN_REQUEST_MS,
  Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_MAX_REQUEST_MS ?? "5000"))
);
const SAFE_MODE_CONCURRENCY = Math.max(
  1,
  Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_CONCURRENCY ?? "1"))
);
const SAFE_MODE_BATCH_LIMIT = Math.max(
  1,
  Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_BATCH_LIMIT ?? "50"))
);
const SAFE_MODE_BATCH_DELAY_MS = Math.max(
  0,
  Math.floor(Number(process.env.ROBLOX_CATALOG_SAFE_MODE_BATCH_DELAY_MS ?? "1500"))
);

const REFRESH_HOURS = Math.max(1, Number(process.env.ROBLOX_CATALOG_REFRESH_HOURS ?? "168"));
const RETRY_HOURS = Math.max(1, Number(process.env.ROBLOX_CATALOG_RETRY_HOURS ?? "6"));
const MAX_RETRY_HOURS = Math.max(RETRY_HOURS, Number(process.env.ROBLOX_CATALOG_MAX_RETRY_HOURS ?? "72"));
const DELETE_RETRY_HOURS = Math.max(REFRESH_HOURS, Number(process.env.ROBLOX_CATALOG_DELETE_RETRY_HOURS ?? "720"));

const DRY_RUN = toBoolean(process.env.ROBLOX_CATALOG_DRY_RUN, false);

type QueueRow = {
  asset_id: number;
  priority: string | null;
  attempts: number | null;
  next_run_at: string | null;
};

type EconomyCreator = {
  Id?: number;
  Name?: string;
  CreatorType?: string;
  CreatorTargetId?: number;
  HasVerifiedBadge?: boolean;
};

type EconomyDetails = {
  AssetId?: number;
  Name?: string;
  Description?: string;
  PriceInRobux?: number;
  IsForSale?: boolean;
  IsLimited?: boolean;
  IsLimitedUnique?: boolean;
  Remaining?: number;
  AssetTypeId?: number;
  ProductId?: number;
  Creator?: EconomyCreator;
  [key: string]: unknown;
};

type ThumbnailEntry = {
  targetId?: number;
  state?: string;
  imageUrl?: string;
  version?: string;
};

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  if (value === "1") return true;
  if (value === "0") return false;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function shouldLog(level: "info" | "debug") {
  const order = { debug: 0, info: 1 };
  const current = LOG_LEVEL in order ? LOG_LEVEL : "info";
  return order[level] >= order[current as keyof typeof order];
}

function logInfo(message: string) {
  if (shouldLog("info")) {
    console.log(message);
  }
}

function logDebug(message: string) {
  if (shouldLog("debug")) {
    console.log(message);
  }
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

function addHours(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function computeRetryHours(attempts: number) {
  const factor = Math.max(0, attempts - 1);
  return Math.min(MAX_RETRY_HOURS, RETRY_HOURS * Math.pow(2, factor));
}

function withJitter(ms: number, jitterMs: number) {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  if (!Number.isFinite(jitterMs) || jitterMs <= 0) return ms;
  return ms + Math.floor(Math.random() * jitterMs);
}

let lastRequestAt = 0;
let requestGate: Promise<void> = Promise.resolve();
let rateLimitUntil = 0;
let rateLimitStrikes = 0;
let dynamicMinIntervalMs = REQUEST_MIN_INTERVAL_MS;
let safeMode = false;

function currentMinInterval() {
  return safeMode ? SAFE_MODE_MIN_REQUEST_MS : REQUEST_MIN_INTERVAL_MS;
}

function currentMaxInterval() {
  return safeMode ? SAFE_MODE_MAX_REQUEST_MS : REQUEST_MAX_INTERVAL_MS;
}

async function throttleRequest() {
  if (currentMinInterval() <= 0 && rateLimitUntil <= Date.now()) return;
  let release: () => void = () => undefined;
  const prev = requestGate;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  const now = Date.now();
  const rateLimitWait = Math.max(0, rateLimitUntil - now);
  if (rateLimitWait > 0) {
    logDebug(`Rate-limit cooldown active. Sleeping ${rateLimitWait}ms.`);
    await sleep(rateLimitWait);
  }
  const waitMs = Math.max(0, lastRequestAt + dynamicMinIntervalMs - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();
  release();
}

function enableSafeMode(reason: string) {
  if (safeMode) return;
  safeMode = true;
  dynamicMinIntervalMs = Math.max(dynamicMinIntervalMs, SAFE_MODE_MIN_REQUEST_MS);
  if (SAFE_MODE_MAX_REQUEST_MS > 0) {
    dynamicMinIntervalMs = Math.min(dynamicMinIntervalMs, SAFE_MODE_MAX_REQUEST_MS);
  }
  logInfo(
    `Safe mode enabled (${reason}). minInterval=${dynamicMinIntervalMs}ms, concurrency=${SAFE_MODE_CONCURRENCY}, batchLimit=${SAFE_MODE_BATCH_LIMIT}`
  );
}

function noteRateLimit(retryAfterMs?: number) {
  rateLimitStrikes = Math.min(rateLimitStrikes + 1, 10);
  const exponential = RATE_LIMIT_COOLDOWN_MS * Math.pow(2, rateLimitStrikes - 1);
  const cooldown = Math.min(RATE_LIMIT_MAX_COOLDOWN_MS, Math.max(exponential, retryAfterMs ?? 0));
  rateLimitUntil = Math.max(rateLimitUntil, Date.now() + cooldown);
  dynamicMinIntervalMs = Math.min(
    currentMaxInterval(),
    Math.max(dynamicMinIntervalMs * 2, currentMinInterval())
  );
  if (rateLimitStrikes >= SAFE_MODE_STRIKES) {
    enableSafeMode(`rate-limit strikes=${rateLimitStrikes}`);
  }
  logInfo(`Rate limit hit. Cooling down ${cooldown}ms. Min interval now ${dynamicMinIntervalMs}ms.`);
}

function noteRequestSuccess() {
  if (rateLimitStrikes > 0) {
    rateLimitStrikes -= 1;
  }
  if (dynamicMinIntervalMs > currentMinInterval()) {
    dynamicMinIntervalMs = Math.max(currentMinInterval(), Math.floor(dynamicMinIntervalMs * 0.9));
  }
}

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEconomyDetails(assetId: number): Promise<{
  ok: boolean;
  status: number;
  payload?: EconomyDetails;
  error?: string;
}> {
  let attempt = 0;
  let rateLimitRetries = 0;
  const url = ECONOMY_DETAILS_API(assetId);

  while (true) {
    await throttleRequest();
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
      }
    });

    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as EconomyDetails | null;
      if (!payload) {
        return { ok: false, status: res.status, error: "Empty economy payload" };
      }
      if (Array.isArray((payload as unknown as { errors?: unknown }).errors)) {
        return { ok: false, status: res.status, error: "Economy response contained errors" };
      }
      const resolvedId = normalizeNumber(payload.AssetId);
      if (!resolvedId) {
        return { ok: false, status: 404, error: "Economy asset not found" };
      }
      noteRequestSuccess();
      return { ok: true, status: res.status, payload };
    }

    if (res.status === 404) {
      return { ok: false, status: 404, error: "Economy asset not found" };
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
      const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined;
      noteRateLimit(retryAfterMs);
      if (rateLimitRetries < RATE_LIMIT_RETRY_LIMIT) {
        rateLimitRetries += 1;
        await sleep(withJitter(RATE_LIMIT_COOLDOWN_MS, RETRY_JITTER_MS));
        continue;
      }
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body.slice(0, 200) || "Economy request failed" };
    }

    const retryAfter = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
    const backoff = Math.max(RETRY_BASE_MS * Math.pow(2, attempt), retryAfterMs);
    attempt += 1;
    await sleep(withJitter(backoff, RETRY_JITTER_MS));
  }
}

async function fetchThumbnails(assetIds: number[]): Promise<ThumbnailEntry[]> {
  if (!assetIds.length) return [];
  const params = new URLSearchParams({
    assetIds: assetIds.join(","),
    size: THUMBNAIL_SIZE,
    format: THUMBNAIL_FORMAT
  });
  const url = `${THUMBNAILS_API}?${params.toString()}`;
  let attempt = 0;
  let rateLimitRetries = 0;

  while (true) {
    await throttleRequest();
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT
      }
    });

    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as { data?: ThumbnailEntry[] } | null;
      if (!payload?.data) return [];
      noteRequestSuccess();
      return payload.data;
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
      const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined;
      noteRateLimit(retryAfterMs);
      if (rateLimitRetries < RATE_LIMIT_RETRY_LIMIT) {
        rateLimitRetries += 1;
        await sleep(withJitter(RATE_LIMIT_COOLDOWN_MS, RETRY_JITTER_MS));
        continue;
      }
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to fetch thumbnails (${res.status}): ${body.slice(0, 200)}`);
    }

    const retryAfter = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
    const backoff = Math.max(RETRY_BASE_MS * Math.pow(2, attempt), retryAfterMs);
    attempt += 1;
    await sleep(withJitter(backoff, RETRY_JITTER_MS));
  }
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

async function pickQueueItems(limit: number): Promise<QueueRow[]> {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("roblox_catalog_refresh_queue")
    .select("asset_id,priority,attempts,next_run_at")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load catalog refresh queue: ${error.message}`);
  }
  return (data ?? []) as QueueRow[];
}

async function upsertCatalogItems(rows: Record<string, unknown>[]) {
  if (!rows.length || DRY_RUN) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, ENRICH_BATCH)) {
    const { error } = await sb.from("roblox_catalog_items").upsert(chunk, { onConflict: "asset_id" });
    if (error) throw new Error(`Failed to upsert catalog items: ${error.message}`);
  }
}

async function upsertQueue(rows: Record<string, unknown>[]) {
  if (!rows.length || DRY_RUN) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, ENRICH_BATCH)) {
    const { error } = await sb.from("roblox_catalog_refresh_queue").upsert(chunk, { onConflict: "asset_id" });
    if (error) throw new Error(`Failed to update refresh queue: ${error.message}`);
  }
}

async function upsertThumbnails(rows: Record<string, unknown>[]) {
  if (!rows.length || DRY_RUN) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, ENRICH_BATCH)) {
    const { error } = await sb
      .from("roblox_catalog_item_images")
      .upsert(chunk, { onConflict: "asset_id,size,format" });
    if (error) throw new Error(`Failed to upsert catalog thumbnails: ${error.message}`);
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function assignDefined(target: Record<string, unknown>, key: string, value: unknown) {
  if (value === null || value === undefined) return;
  target[key] = value;
}

async function run() {
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalThumbnails = 0;
  let batchIndex = 0;

  while (true) {
    if (ENRICH_MAX_TOTAL > 0 && totalProcessed >= ENRICH_MAX_TOTAL) {
      break;
    }

    const baseLimit = safeMode ? SAFE_MODE_BATCH_LIMIT : ENRICH_LIMIT;
    const batchLimit =
      ENRICH_MAX_TOTAL > 0 ? Math.min(baseLimit, ENRICH_MAX_TOTAL - totalProcessed) : baseLimit;
    const queue = await pickQueueItems(batchLimit);
    if (!queue.length) {
      if (batchIndex === 0) {
        logInfo("No catalog items ready for enrichment.");
      }
      break;
    }

    batchIndex += 1;
    logInfo(
      `Starting enrichment batch ${batchIndex}: ${queue.length} items (processed ${totalProcessed} so far, minInterval=${dynamicMinIntervalMs}ms, mode=${safeMode ? "safe" : "normal"}).`
    );

    const itemUpdates: Record<string, unknown>[] = [];
    const queueUpdates: Record<string, unknown>[] = [];
    const thumbnailTargets: number[] = [];
    const errorStats = new Map<string, number>();
    let loggedErrors = 0;

    await promisePool(queue, safeMode ? SAFE_MODE_CONCURRENCY : ENRICH_CONCURRENCY, async (entry) => {
      const assetId = entry.asset_id;
      const attempts = entry.attempts ?? 0;
      const priority = entry.priority ?? "new";
      const nowIso = new Date().toISOString();

      let details: Awaited<ReturnType<typeof fetchEconomyDetails>>;
      try {
        details = await fetchEconomyDetails(assetId);
      } catch (error) {
        const message = (error as Error).message ?? "Economy fetch failed";
        const key = `fetch_error:${message.slice(0, 80)}`;
        errorStats.set(key, (errorStats.get(key) ?? 0) + 1);
        if (loggedErrors < MAX_ERROR_LOGS) {
          logInfo(`Economy fetch error for ${assetId}: ${message}`);
          loggedErrors += 1;
        }
        queueUpdates.push({
          asset_id: assetId,
          priority,
          attempts: attempts + 1,
          last_attempt_at: nowIso,
          last_error: message,
          next_run_at: addHours(nowIso, computeRetryHours(attempts + 1))
        });
        return;
      }

      if (details.ok && details.payload) {
        const payload = details.payload;
        const creator = payload.Creator ?? null;
        const update: Record<string, unknown> = {
          asset_id: assetId,
          last_enriched_at: nowIso,
          raw_economy_json: payload,
          is_deleted: false
        };

        assignDefined(update, "name", normalizeText(payload.Name));
        assignDefined(update, "description", normalizeText(payload.Description));
        assignDefined(update, "price_robux", normalizeNumber(payload.PriceInRobux));
        assignDefined(update, "is_for_sale", normalizeBoolean(payload.IsForSale));
        assignDefined(update, "is_limited", normalizeBoolean(payload.IsLimited));
        assignDefined(update, "is_limited_unique", normalizeBoolean(payload.IsLimitedUnique));
        assignDefined(update, "remaining", normalizeNumber(payload.Remaining));
        assignDefined(update, "asset_type_id", normalizeNumber(payload.AssetTypeId));
        assignDefined(update, "product_id", normalizeNumber(payload.ProductId));

        if (creator) {
          assignDefined(update, "creator_id", normalizeNumber(creator.Id));
          assignDefined(update, "creator_target_id", normalizeNumber(creator.CreatorTargetId));
          assignDefined(update, "creator_name", normalizeText(creator.Name));
          assignDefined(update, "creator_type", normalizeText(creator.CreatorType));
          assignDefined(update, "creator_has_verified_badge", normalizeBoolean(creator.HasVerifiedBadge));
        }

        itemUpdates.push(update);
        thumbnailTargets.push(assetId);

        queueUpdates.push({
          asset_id: assetId,
          priority,
          attempts: 0,
          last_attempt_at: nowIso,
          last_error: null,
          next_run_at: addHours(nowIso, REFRESH_HOURS)
        });
        return;
      }

      const nextAttempts = attempts + 1;
      const errorMessage = details.error ?? "Unknown error";
      const errorKey = details.status ? `${details.status}` : "error";
      errorStats.set(errorKey, (errorStats.get(errorKey) ?? 0) + 1);
      if (loggedErrors < MAX_ERROR_LOGS) {
        logInfo(`Economy error for ${assetId} (${errorKey}): ${errorMessage}`);
        loggedErrors += 1;
      }

      if (details.status === 404) {
        itemUpdates.push({
          asset_id: assetId,
          is_deleted: true,
          last_enriched_at: nowIso
        });
        queueUpdates.push({
          asset_id: assetId,
          priority,
          attempts: nextAttempts,
          last_attempt_at: nowIso,
          last_error: errorMessage,
          next_run_at: addHours(nowIso, DELETE_RETRY_HOURS)
        });
        return;
      }

      if (details.status === 429) {
        queueUpdates.push({
          asset_id: assetId,
          priority,
          attempts: nextAttempts,
          last_attempt_at: nowIso,
          last_error: errorMessage,
          next_run_at: addMinutes(nowIso, RATE_LIMIT_REQUEUE_MINUTES)
        });
        return;
      }

      queueUpdates.push({
        asset_id: assetId,
        priority,
        attempts: nextAttempts,
        last_attempt_at: nowIso,
        last_error: errorMessage,
        next_run_at: addHours(nowIso, computeRetryHours(nextAttempts))
      });
    });

    if (itemUpdates.length) {
      await upsertCatalogItems(itemUpdates);
    }

    if (queueUpdates.length) {
      await upsertQueue(queueUpdates);
    }

    if (thumbnailTargets.length) {
      const thumbnailRows: Record<string, unknown>[] = [];
      for (const batch of chunkArray(thumbnailTargets, THUMBNAIL_BATCH)) {
        try {
          const entries = await fetchThumbnails(batch);
          entries.forEach((entry) => {
            const targetId = normalizeNumber(entry.targetId);
            if (!targetId) return;
            thumbnailRows.push({
              asset_id: targetId,
              size: THUMBNAIL_SIZE,
              format: THUMBNAIL_FORMAT,
              image_url: normalizeText(entry.imageUrl),
              state: normalizeText(entry.state),
              version: normalizeText(entry.version),
              last_checked_at: new Date().toISOString()
            });
          });
        } catch (error) {
          const message = (error as Error).message ?? "Thumbnail fetch failed";
          logInfo(`Thumbnail batch failed (${batch.length} items): ${message}`);
        }
        await sleep(withJitter(THUMBNAIL_DELAY_MS, RETRY_JITTER_MS));
      }
      if (thumbnailRows.length) {
        await upsertThumbnails(thumbnailRows);
      }
    }

    totalProcessed += queue.length;
    totalUpdated += itemUpdates.length;
    totalThumbnails += thumbnailTargets.length;

    if (errorStats.size) {
      const summary = Array.from(errorStats.entries())
        .map(([key, count]) => `${key}:${count}`)
        .join(", ");
      logInfo(`Batch ${batchIndex} errors: ${summary}`);
    }

    logInfo(
      `Batch ${batchIndex} complete. Items: ${queue.length}, updates: ${itemUpdates.length}, thumbnails: ${thumbnailTargets.length}.`
    );

    await sleep(withJitter(safeMode ? SAFE_MODE_BATCH_DELAY_MS : BATCH_DELAY_MS, RETRY_JITTER_MS));
  }

  logInfo(
    `Catalog enrichment complete. Processed: ${totalProcessed}, updates: ${totalUpdated}, thumbnails: ${totalThumbnails}`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
