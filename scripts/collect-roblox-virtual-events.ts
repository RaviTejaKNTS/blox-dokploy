import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidateEventsByUniverseIds } from "./lib/revalidate-events";

const VIRTUAL_EVENTS_API_BASE = "https://apis.roblox.com/virtual-events/v1/universes";
const CHUNK_SIZE = 200;
const DEFAULT_UNIVERSE_LIMIT = Number(process.env.ROBLOX_VIRTUAL_EVENTS_LIMIT ?? "100");
const REQUEST_DELAY_MS = Number(process.env.ROBLOX_VIRTUAL_EVENTS_DELAY_MS ?? "150");

type RawEvent = Record<string, unknown>;

type EventRow = {
  event_id: string;
  universe_id: number | null;
  place_id: number | null;
  title: string | null;
  display_title: string | null;
  subtitle: string | null;
  display_subtitle: string | null;
  description: string | null;
  display_description: string | null;
  tagline: string | null;
  start_utc: string | null;
  end_utc: string | null;
  created_utc: string | null;
  updated_utc: string | null;
  event_status: string | null;
  event_visibility: string | null;
  featuring_status: string | null;
  all_thumbnails_created: boolean | null;
  host_name: string | null;
  host_has_verified_badge: boolean | null;
  host_type: string | null;
  host_id: number | null;
  raw_event_json: RawEvent;
};

type CategoryRow = {
  event_id: string;
  category: string;
  rank: number;
};

type ThumbnailRow = {
  event_id: string;
  media_id: number;
  rank: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function pickValue(source: Record<string, unknown> | null, keys: string[]): unknown {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function extractEvents(payload: unknown): RawEvent[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const direct = pickValue(payload, ["data", "events"]);
  if (Array.isArray(direct)) return direct.filter(isRecord);
  if (isRecord(direct)) {
    const nested = pickValue(direct, ["data", "events", "items", "results"]);
    if (Array.isArray(nested)) return nested.filter(isRecord);
  }
  return [];
}

function extractArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const nested = pickValue(value, ["data", "items", "results"]);
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function assignRank(used: Set<number>, candidate: number | null, fallback: number): number {
  let rank = Number.isFinite(candidate ?? NaN) ? Math.floor(candidate as number) : fallback;
  if (!Number.isFinite(rank)) rank = fallback;
  if (rank < 0) rank = fallback;
  while (used.has(rank)) {
    rank += 1;
  }
  used.add(rank);
  return rank;
}

function buildEventRow(event: RawEvent, universeId: number | null): EventRow | null {
  const rawId = pickValue(event, ["id", "eventId", "event_id"]);
  const eventId = typeof rawId === "string" ? rawId.trim() : typeof rawId === "number" ? String(rawId) : null;
  if (!eventId) return null;

  const eventTimeRaw = pickValue(event, ["eventTime", "event_time"]);
  const eventTime = isRecord(eventTimeRaw) ? eventTimeRaw : null;

  const hostRaw = pickValue(event, ["host", "creator", "eventHost"]);
  const host = isRecord(hostRaw) ? hostRaw : null;

  const row: EventRow = {
    event_id: eventId,
    universe_id: normalizeNumber(pickValue(event, ["universeId", "universe_id"])) ?? universeId,
    place_id: normalizeNumber(pickValue(event, ["placeId", "place_id"])),
    title: normalizeText(pickValue(event, ["title"])),
    display_title: normalizeText(pickValue(event, ["displayTitle", "display_title"])),
    subtitle: normalizeText(pickValue(event, ["subtitle"])),
    display_subtitle: normalizeText(pickValue(event, ["displaySubtitle", "display_subtitle"])),
    description: normalizeText(pickValue(event, ["description"])),
    display_description: normalizeText(pickValue(event, ["displayDescription", "display_description"])),
    tagline: normalizeText(pickValue(event, ["tagline"])),
    start_utc: normalizeTimestamp(pickValue(eventTime, ["startUtc", "start_utc", "startUTC"])),
    end_utc: normalizeTimestamp(pickValue(eventTime, ["endUtc", "end_utc", "endUTC"])),
    created_utc: normalizeTimestamp(pickValue(event, ["createdUtc", "created_utc", "createdAt", "created_at"])),
    updated_utc: normalizeTimestamp(pickValue(event, ["updatedUtc", "updated_utc", "updatedAt", "updated_at"])),
    event_status: normalizeText(pickValue(event, ["eventStatus", "event_status", "status"])),
    event_visibility: normalizeText(pickValue(event, ["eventVisibility", "event_visibility", "visibility"])),
    featuring_status: normalizeText(pickValue(event, ["featuringStatus", "featuring_status"])),
    all_thumbnails_created: normalizeBoolean(pickValue(event, ["allThumbnailsCreated", "all_thumbnails_created"])),
    host_name: normalizeText(pickValue(host, ["name", "displayName"])) ?? normalizeText(pickValue(event, ["hostName", "host_name"])),
    host_has_verified_badge:
      normalizeBoolean(pickValue(host, ["hasVerifiedBadge", "has_verified_badge"])) ??
      normalizeBoolean(pickValue(event, ["hostHasVerifiedBadge", "host_has_verified_badge"])),
    host_type: normalizeText(pickValue(host, ["type", "hostType"])) ?? normalizeText(pickValue(event, ["hostType", "host_type"])),
    host_id: normalizeNumber(pickValue(host, ["id", "hostId", "host_id"])) ?? normalizeNumber(pickValue(event, ["hostId", "host_id"])),
    raw_event_json: event
  };

  return row;
}

function buildCategoryRows(event: RawEvent, eventId: string): CategoryRow[] {
  const raw = pickValue(event, ["eventCategories", "event_categories", "categories"]);
  const entries = extractArray(raw);
  const rows: CategoryRow[] = [];
  const usedRanks = new Set<number>();
  entries.forEach((entry, index) => {
    let categoryValue: unknown = entry;
    let rankValue: unknown = null;
    if (isRecord(entry)) {
      categoryValue = pickValue(entry, ["category", "name", "type", "displayName"]);
      rankValue = pickValue(entry, ["rank", "order", "index", "position"]);
    }
    const category = normalizeText(categoryValue);
    if (!category) return;
    const rank = assignRank(usedRanks, normalizeNumber(rankValue), index + 1);
    rows.push({ event_id: eventId, category, rank });
  });
  return rows;
}

function buildThumbnailRows(event: RawEvent, eventId: string): ThumbnailRow[] {
  const raw = pickValue(event, ["thumbnails", "media", "eventThumbnails"]);
  const entries = extractArray(raw);
  const rows: ThumbnailRow[] = [];
  const usedRanks = new Set<number>();
  entries.forEach((entry, index) => {
    let mediaValue: unknown = entry;
    let rankValue: unknown = null;
    if (isRecord(entry)) {
      mediaValue = pickValue(entry, ["mediaId", "media_id", "id", "assetId"]);
      rankValue = pickValue(entry, ["rank", "order", "index", "position"]);
    }
    const mediaId = normalizeNumber(mediaValue);
    if (mediaId === null) return;
    const rank = assignRank(usedRanks, normalizeNumber(rankValue), index + 1);
    rows.push({ event_id: eventId, media_id: mediaId, rank });
  });
  return rows;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function clampLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.floor(value));
}

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVirtualEvents(universeId: number): Promise<RawEvent[]> {
  const url = `${VIRTUAL_EVENTS_API_BASE}/${universeId}/virtual-events`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "BloxodesVirtualEvents/1.0"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch virtual events (${res.status}): ${body.slice(0, 200)}`);
  }
  const payload = await res.json();
  return extractEvents(payload);
}

async function upsertEvents(rows: EventRow[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
    const { error } = await sb.from("roblox_virtual_events").upsert(chunk, { onConflict: "event_id" });
    if (error) {
      throw new Error(`Failed to upsert events: ${error.message}`);
    }
  }
}

async function upsertChildRows<T extends CategoryRow | ThumbnailRow>(table: string, rows: T[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "event_id,rank" });
    if (error) {
      throw new Error(`Failed to upsert ${table} rows: ${error.message}`);
    }
  }
}

async function stampFirstLiveAt(eventIds: string[]) {
  if (!eventIds.length) return;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("roblox_virtual_events")
    .update({ first_live_at: new Date().toISOString() })
    .in("event_id", eventIds)
    .is("first_live_at", null)
    .ilike("event_status", "active")
    .ilike("event_visibility", "public");

  if (error) {
    throw new Error(`Failed to stamp first_live_at: ${error.message}`);
  }
}

async function fetchTopUniverses(limit: number): Promise<number[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, playing")
    .not("playing", "is", null)
    .order("playing", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to fetch top universes: ${error.message}`);
  }
  return (data ?? [])
    .map((row) => (typeof row?.universe_id === "number" ? row.universe_id : null))
    .filter((value): value is number => typeof value === "number");
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment.");
  }

  const arg = process.env.ROBLOX_VIRTUAL_EVENTS_UNIVERSE_ID ?? process.argv[2];
  const limit = clampLimit(DEFAULT_UNIVERSE_LIMIT, 100);
  const universeIds = arg
    ? [Number(arg)].filter((value) => Number.isFinite(value))
    : await fetchTopUniverses(limit);

  if (!universeIds.length) {
    console.log("No universe IDs available to fetch.");
    return;
  }

  console.log(`Fetching virtual events for ${universeIds.length} universes...`);
  const updatedUniverses = new Set<number>();

  for (const universeId of universeIds) {
    try {
      const events = await fetchVirtualEvents(universeId);
      if (!events.length) {
        console.log(`  • ${universeId}: no events`);
        continue;
      }

      const eventMap = new Map<string, EventRow>();
      const categoryRows: CategoryRow[] = [];
      const thumbnailRows: ThumbnailRow[] = [];

      events.forEach((event) => {
        const row = buildEventRow(event, universeId);
        if (!row) return;
        eventMap.set(row.event_id, row);
        categoryRows.push(...buildCategoryRows(event, row.event_id));
        thumbnailRows.push(...buildThumbnailRows(event, row.event_id));
      });

      const eventRows = Array.from(eventMap.values());
      if (!eventRows.length) {
        console.log(`  • ${universeId}: no valid events`);
        continue;
      }

      await upsertEvents(eventRows);
      await stampFirstLiveAt(eventRows.map((row) => row.event_id));
      await upsertChildRows("roblox_virtual_event_categories", categoryRows);
      await upsertChildRows("roblox_virtual_event_thumbnails", thumbnailRows);
      updatedUniverses.add(universeId);

      console.log(
        `  • ${universeId}: ${eventRows.length} events, ${categoryRows.length} categories, ${thumbnailRows.length} thumbnails`
      );
    } catch (error) {
      console.error(`  • ${universeId}: failed -`, (error as Error).message);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  await revalidateEventsByUniverseIds(Array.from(updatedUniverses));
  console.log("Virtual events collection complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
