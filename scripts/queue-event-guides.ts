import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";

const WAIT_HOURS = Number(process.env.EVENT_GUIDE_WAIT_HOURS ?? "6");
const MIN_DURATION_HOURS = Number(process.env.EVENT_GUIDE_MIN_DURATION_HOURS ?? "24");
const MAX_AGE_DAYS = Number(process.env.EVENT_GUIDE_MAX_AGE_DAYS ?? "5");
const EVENT_BATCH = Number(process.env.EVENT_GUIDE_EVENT_BATCH ?? "200");
const DEFAULT_LIMIT = Number(process.env.EVENT_GUIDE_LIMIT ?? "10");

type EventRow = {
  event_id: string;
  universe_id: number | null;
  title: string | null;
  display_title: string | null;
  start_utc: string | null;
  end_utc: string | null;
  event_status: string | null;
  event_visibility: string | null;
  guide_slug: string | null;
};

type UniverseRow = {
  universe_id: number;
  display_name: string | null;
  name: string | null;
};

type QueueRow = {
  id: string;
  event_id: string | null;
  status: "pending" | "completed" | "failed";
};

type ScriptArgs = {
  eventId: string | null;
  limit: number;
  dryRun: boolean;
  force: boolean;
};

type EligibleEvent = EventRow & {
  eventName: string;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isEmpty(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function getEventDisplayName(event: EventRow): string | null {
  return normalizeText(event.display_title) ?? normalizeText(event.title);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseArgs(): ScriptArgs {
  const args = process.argv.slice(2);
  let eventId: string | null = null;
  let limit = DEFAULT_LIMIT;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--dry-run" || arg === "--dryrun") {
      dryRun = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--limit") {
      const next = args[i + 1];
      if (next) {
        const parsed = Number(next);
        limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : limit;
      }
      i += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : limit;
      continue;
    }
    if (arg === "--event-id") {
      eventId = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--event-id=")) {
      eventId = arg.slice("--event-id=".length) || null;
      continue;
    }
    if (!eventId) {
      eventId = arg;
    }
  }

  return {
    eventId: normalizeText(eventId),
    limit,
    dryRun,
    force
  };
}

async function fetchEventById(eventId: string): Promise<EventRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, title, display_title, start_utc, end_utc, event_status, event_visibility, guide_slug"
    )
    .eq("event_id", eventId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to load event ${eventId}: ${error.message}`);
  }

  return ((data ?? [])[0] as EventRow | undefined) ?? null;
}

async function fetchEventCandidates(
  limit: number,
  cutoffIso: string,
  minStartIso: string,
  force: boolean
): Promise<EventRow[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, title, display_title, start_utc, end_utc, event_status, event_visibility, guide_slug"
    )
    .not("start_utc", "is", null)
    .not("end_utc", "is", null)
    .gte("start_utc", minStartIso)
    .lte("start_utc", cutoffIso)
    .ilike("event_status", "active")
    .ilike("event_visibility", "public")
    .order("start_utc", { ascending: true })
    .limit(limit);

  if (!force) {
    query = query.or("guide_slug.is.null,guide_slug.eq.");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load event candidates: ${error.message}`);
  }

  return (data ?? []) as EventRow[];
}

async function fetchUniverses(universeIds: number[]): Promise<Map<number, UniverseRow>> {
  const sb = supabaseAdmin();
  const map = new Map<number, UniverseRow>();
  for (const chunk of chunkArray(universeIds, 200)) {
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, display_name, name")
      .in("universe_id", chunk);

    if (error) {
      throw new Error(`Failed to load universes: ${error.message}`);
    }

    for (const row of (data ?? []) as UniverseRow[]) {
      map.set(row.universe_id, row);
    }
  }
  return map;
}

async function fetchQueueRows(eventIds: string[]): Promise<Map<string, QueueRow>> {
  const sb = supabaseAdmin();
  const map = new Map<string, QueueRow>();
  if (!eventIds.length) return map;

  for (const chunk of chunkArray(eventIds, EVENT_BATCH)) {
    const { data, error } = await sb
      .from("event_guide_generation_queue")
      .select("id, event_id, status")
      .in("event_id", chunk);

    if (error) {
      throw new Error(`Failed to load article queue: ${error.message}`);
    }

    for (const row of (data ?? []) as QueueRow[]) {
      if (row.event_id) {
        map.set(row.event_id, row);
      }
    }
  }

  return map;
}

async function requeueFailed(queueId: string, dryRun: boolean) {
  if (dryRun) return;
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("event_guide_generation_queue")
    .update({
      status: "pending",
      attempts: 0,
      last_error: null,
      last_attempted_at: null
    })
    .eq("id", queueId)
    .eq("status", "failed");

  if (error) {
    throw new Error(`Failed to requeue article task ${queueId}: ${error.message}`);
  }
}

async function insertQueueEntries(entries: Array<Record<string, unknown>>, dryRun: boolean) {
  if (!entries.length) return;
  if (dryRun) return;

  const sb = supabaseAdmin();
  for (const chunk of chunkArray(entries, 50)) {
    const { error } = await sb.from("event_guide_generation_queue").insert(chunk);
    if (error) {
      throw new Error(`Failed to insert event guide queue entries: ${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs();
  const now = Date.now();
  const waitMs = WAIT_HOURS * 60 * 60 * 1000;
  const minDurationMs = MIN_DURATION_HOURS * 60 * 60 * 1000;
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(now - waitMs).toISOString();
  const minStartIso = new Date(now - maxAgeMs).toISOString();

  let events: EventRow[] = [];

  if (args.eventId) {
    const event = await fetchEventById(args.eventId);
    if (!event) {
      console.error(`No event found for event_id ${args.eventId}.`);
      return;
    }
    events = [event];
  } else {
    events = await fetchEventCandidates(Math.max(args.limit, EVENT_BATCH), cutoffIso, minStartIso, args.force);
  }

  if (!events.length) {
    console.log("No event candidates found.");
    return;
  }

  const stats = {
    total: events.length,
    missingName: 0,
    missingUniverse: 0,
    hasGuide: 0,
    notStartedLongEnough: 0,
    tooShort: 0,
    tooOld: 0,
    ended: 0
  };

  const eligible: EligibleEvent[] = [];

  for (const event of events) {
    if (!args.force && !isEmpty(event.guide_slug)) {
      stats.hasGuide += 1;
      continue;
    }

    const eventName = getEventDisplayName(event);
    if (!eventName) {
      stats.missingName += 1;
      continue;
    }

    if (!event.universe_id) {
      stats.missingUniverse += 1;
      continue;
    }

    const startTime = parseDate(event.start_utc);
    const endTime = parseDate(event.end_utc);

    if (!args.force) {
      if (!startTime || startTime < now - maxAgeMs) {
        stats.tooOld += 1;
        continue;
      }
      if (!startTime || startTime > now - waitMs) {
        stats.notStartedLongEnough += 1;
        continue;
      }
      if (!startTime || !endTime || endTime - startTime < minDurationMs) {
        stats.tooShort += 1;
        continue;
      }
      if (endTime <= now) {
        stats.ended += 1;
        continue;
      }
    }

    eligible.push({ ...event, eventName });
  }

  if (!eligible.length) {
    console.log("No eligible live events found for guide generation.");
    console.log(`stats=${JSON.stringify(stats)}`);
    return;
  }

  const universeIds = Array.from(
    new Set(eligible.map((event) => event.universe_id).filter((id): id is number => typeof id === "number"))
  );
  const universeMap = await fetchUniverses(universeIds);

  const eventIds = eligible.map((event) => event.event_id).filter(Boolean);
  const queueMap = await fetchQueueRows(eventIds);

  const inserts: Array<Record<string, unknown>> = [];
  let requeued = 0;
  let skipped = 0;

  for (const event of eligible.slice(0, args.limit)) {
    const existing = queueMap.get(event.event_id);
    if (existing) {
      if (existing.status === "failed" && args.force) {
        await requeueFailed(existing.id, args.dryRun);
        requeued += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const universe = event.universe_id ? universeMap.get(event.universe_id) : null;
    const gameName = universe?.display_name ?? universe?.name ?? `Universe ${event.universe_id ?? "unknown"}`;
    const articleTitle = `${gameName} ${event.eventName} Guide`.replace(/\s+/g, " ").trim();

    inserts.push({
      guide_title: articleTitle,
      universe_id: event.universe_id,
      event_id: event.event_id
    });
  }

  await insertQueueEntries(inserts, args.dryRun);

  console.log(
    JSON.stringify({
      queued: inserts.length,
      requeued,
      skipped,
      dryRun: args.dryRun,
      waitHours: WAIT_HOURS,
      minDurationHours: MIN_DURATION_HOURS
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
