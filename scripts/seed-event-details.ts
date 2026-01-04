import "dotenv/config";

import OpenAI from "openai";

import { supabaseAdmin } from "@/lib/supabase";
import { revalidateEventsByUniverseIds } from "./lib/revalidate-events";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!PERPLEXITY_API_KEY) {
  throw new Error("Missing PERPLEXITY_API_KEY.");
}

if (!OPENAI_KEY) {
  throw new Error("Missing OPENAI_API_KEY.");
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
}

const perplexity = new OpenAI({ apiKey: PERPLEXITY_API_KEY, baseURL: "https://api.perplexity.ai" });
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const PAGE_BATCH = Number(process.env.EVENT_DETAILS_PAGE_BATCH ?? "1000");
const EVENT_BATCH = Number(process.env.EVENT_DETAILS_EVENT_BATCH ?? "200");
const SEARCH_LIMIT = Number(process.env.EVENT_DETAILS_SEARCH_LIMIT ?? "8");
const MAX_SOURCES = Number(process.env.EVENT_DETAILS_MAX_SOURCES ?? "6");
const SEARCH_DELAY_MS = Number(process.env.EVENT_DETAILS_SEARCH_DELAY_MS ?? "350");

type EventRow = {
  event_id: string;
  universe_id: number | null;
  title: string | null;
  display_title: string | null;
  start_utc: string | null;
  end_utc: string | null;
  event_status: string | null;
  event_summary_md: string | null;
  event_details_md: string | null;
};

type UniverseRow = {
  universe_id: number;
  display_name: string | null;
  name: string | null;
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type GenerateCopyResult = {
  event_summary_md: string;
  event_details_md: string;
};

type ScriptArgs = {
  eventId: string | null;
  force: boolean;
};

const BLOCKED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "discord.gg"
];

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isEmpty(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function getEventDisplayName(event: EventRow): string {
  return normalizeText(event.display_title) ?? normalizeText(event.title) ?? "Upcoming event";
}

function parseArgs(): ScriptArgs {
  const args = process.argv.slice(2);
  let eventId: string | null = null;
  let force = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--force") {
      force = true;
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
    force
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function isBlockedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    return BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return true;
  }
}

function formatSources(sources: SearchResult[]): string {
  return sources
    .map((source, index) => {
      const snippet = source.snippet ? source.snippet.replace(/\s+/g, " ").trim() : "";
      return [
        `Source ${index + 1}: ${source.title}`,
        source.url,
        snippet ? `Snippet: ${snippet}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEventPagesUniverseIds(): Promise<number[]> {
  const sb = supabaseAdmin();
  const ids = new Set<number>();
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("events_pages")
      .select("universe_id")
      .order("universe_id", { ascending: true })
      .range(offset, offset + PAGE_BATCH - 1);

    if (error) {
      throw new Error(`Failed to load events pages: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ universe_id?: number | null }>;
    for (const row of rows) {
      if (typeof row.universe_id === "number") {
        ids.add(row.universe_id);
      }
    }

    if (rows.length < PAGE_BATCH) break;
    offset += rows.length;
  }

  return Array.from(ids.values());
}

async function fetchEventById(eventId: string): Promise<EventRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, title, display_title, start_utc, end_utc, event_status, event_summary_md, event_details_md"
    )
    .eq("event_id", eventId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to load event ${eventId}: ${error.message}`);
  }

  return ((data ?? [])[0] as EventRow | undefined) ?? null;
}

async function fetchUpcomingEvents(universeIds: number[], nowIso: string, force: boolean): Promise<EventRow[]> {
  if (!universeIds.length) return [];
  const sb = supabaseAdmin();
  let query = sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, title, display_title, start_utc, end_utc, event_status, event_summary_md, event_details_md"
    )
    .in("universe_id", universeIds)
    .gt("start_utc", nowIso)
    .order("start_utc", { ascending: true });

  if (!force) {
    query = query.or("event_summary_md.is.null,event_summary_md.eq.,event_details_md.is.null,event_details_md.eq.");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load upcoming events: ${error.message}`);
  }

  return (data ?? []) as EventRow[];
}

async function fetchUniverseById(universeId: number): Promise<UniverseRow | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, display_name, name")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load universe ${universeId}: ${error.message}`);
  }

  return (data as UniverseRow | null) ?? null;
}

async function pickNextEvent(force: boolean): Promise<EventRow | null> {
  const universeIds = await fetchEventPagesUniverseIds();
  if (!universeIds.length) return null;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let candidate: EventRow | null = null;
  let candidateStart = Number.POSITIVE_INFINITY;

  for (const chunk of chunkArray(universeIds, EVENT_BATCH)) {
    const events = await fetchUpcomingEvents(chunk, nowIso, force);
    for (const event of events) {
      const status = event.event_status?.toLowerCase() ?? "";
      if (status === "ended" || status === "cancelled") continue;

      const needsSummary = force || isEmpty(event.event_summary_md);
      const needsDetails = force || isEmpty(event.event_details_md);
      if (!needsSummary && !needsDetails) continue;

      const startTime = parseDate(event.start_utc);
      if (!startTime || startTime <= now) continue;

      if (startTime < candidateStart) {
        candidateStart = startTime;
        candidate = event;
      }
    }
  }

  return candidate;
}

async function perplexitySearch(query: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      top_k: limit
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity search failed (${response.status}) for query "${query}".`);
  }

  const payload = (await response.json()) as { results?: { title?: string; url?: string; snippet?: string }[] };
  return (
    payload.results
      ?.map((result) => ({
        title: result.title?.trim() ?? "",
        url: result.url?.trim() ?? "",
        snippet: result.snippet?.trim() ?? ""
      }))
      .filter((result) => result.title && result.url) ?? []
  );
}

async function gatherSources(gameName: string, eventName: string): Promise<SearchResult[]> {
  const queries = [
    `"${eventName}" "${gameName}" Roblox event`,
    `"${eventName}" Roblox update`,
    `"${eventName}" "${gameName}" event rewards`
  ];

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const query of queries) {
    const items = await perplexitySearch(query, SEARCH_LIMIT);
    for (const item of items) {
      if (!item.url || isBlockedUrl(item.url)) continue;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      results.push(item);
      if (results.length >= MAX_SOURCES) return results;
    }
    await sleep(SEARCH_DELAY_MS);
  }

  return results.slice(0, MAX_SOURCES);
}

async function sonarResearchNotes(gameName: string, eventName: string, sources: SearchResult[]): Promise<string> {
  const prompt = `
Game: "${gameName}"
Event: "${eventName}"

Use the sources below to provide concise research notes about:
- What this event is about.
- What official info we know about this event
- What we can expect from this upcoming event. 
- All the info we know about this event until now
- Any unique mechanics tied to the event.

Avoid dates, times, countdowns, and schedules. Do not include URLs.

Sources:
${formatSources(sources) || "No sources available."}
`.trim();

  const completion = await perplexity.chat.completions.create({
    model: "sonar",
    temperature: 0.2,
    max_tokens: 700,
    messages: [
      { role: "system", content: "Return concise research notes. Do not include URLs." },
      { role: "user", content: prompt }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

function parseCopyJson(raw: string, eventName: string): GenerateCopyResult {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const jsonText = start !== -1 && end !== -1 ? trimmed.slice(start, end + 1) : trimmed;
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Failed to parse JSON from model response: ${(error as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Model response JSON was not an object.");
  }

  const summary = (parsed as { event_summary_md?: unknown }).event_summary_md;
  const details = (parsed as { event_details_md?: unknown }).event_details_md;

  if (typeof summary !== "string" || typeof details !== "string") {
    throw new Error("Model response JSON is missing event_summary_md or event_details_md.");
  }

  const replaceEmDashes = (value: string) => value.replace(/[ \t]*\u2014[ \t]*/g, ": ");
  const summaryClean = replaceEmDashes(summary.trim());
  let detailsClean = replaceEmDashes(details.trim()).replace(/\n{3,}/g, "\n\n");

  const heading = `## What to expect from ${eventName}`;
  if (!detailsClean.startsWith(heading)) {
    detailsClean = detailsClean.replace(/^#+\s.*\n+/, "").trim();
    detailsClean = `${heading}\n\n${detailsClean}`;
  }

  if (!summaryClean || !detailsClean || detailsClean === heading) {
    throw new Error("Model response contained empty summary or details.");
  }

  return { event_summary_md: summaryClean, event_details_md: detailsClean };
}

async function generateEventCopy(gameName: string, eventName: string, notes: string): Promise<GenerateCopyResult> {
  const prompt = `
You are writing copy for an upcoming Roblox event.

Game: "${gameName}"
Event: "${eventName}"

Use only the research notes below. Do not invent facts. If something is not mentioned, leave it out.
Do not mention dates, times, countdowns, or schedules.

Return ONLY JSON with:
- event_summary_md: 1-2 short sentences, no headings, simple English. Explain what the event is. Give a clean context and make it easy for everyone to understand. 
- event_details_md: Include all the details we know about this uncoming event. Do not mention any sources. Just write the info with a clean flow, simple english in a way that anyone can understand. Can use paras, tables or bullet points which ever works better to communicate the info. When using tables or bullet, write atleast some lines before to set up the context and give cue to the readers. 

Research notes:
${notes || "No research notes available."}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }]
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  return parseCopyJson(raw, eventName);
}

async function main() {
  const args = parseArgs();
  const sb = supabaseAdmin();

  let event = args.eventId ? await fetchEventById(args.eventId) : null;

  if (!event) {
    if (args.eventId) {
      console.error(`No event found for event_id ${args.eventId}.`);
      return;
    }
    event = await pickNextEvent(args.force);
  }

  if (!event) {
    console.log("No upcoming events found that need event summary/details.");
    return;
  }

  const universeId = event.universe_id;
  if (!universeId) {
    throw new Error(`Event ${event.event_id} is missing universe_id.`);
  }

  const universe = await fetchUniverseById(universeId);
  const gameName = universe?.display_name ?? universe?.name ?? `Universe ${universeId}`;
  const eventName = getEventDisplayName(event);

  const needsSummary = args.force || isEmpty(event.event_summary_md);
  const needsDetails = args.force || isEmpty(event.event_details_md);
  if (!needsSummary && !needsDetails) {
    console.log(`Event ${event.event_id} already has summary and details.`);
    return;
  }

  console.log(`Generating event copy for "${eventName}" (${gameName})...`);

  const sources = await gatherSources(gameName, eventName);
  if (!sources.length) {
    console.error("No sources found from Perplexity search. Skipping.");
    return;
  }

  const notes = await sonarResearchNotes(gameName, eventName, sources);
  if (!notes.trim()) {
    console.error("No research notes returned from Perplexity sonar. Skipping.");
    return;
  }

  const copy = await generateEventCopy(gameName, eventName, notes);
  const update: Partial<Pick<EventRow, "event_summary_md" | "event_details_md">> = {};

  if (needsSummary) {
    update.event_summary_md = copy.event_summary_md;
  }
  if (needsDetails) {
    update.event_details_md = copy.event_details_md;
  }

  if (!Object.keys(update).length) {
    console.log("Nothing to update.");
    return;
  }

  const { error } = await sb.from("roblox_virtual_events").update(update).eq("event_id", event.event_id);
  if (error) {
    throw new Error(`Failed to update event ${event.event_id}: ${error.message}`);
  }

  await revalidateEventsByUniverseIds([universeId]);
  console.log(`Updated event ${event.event_id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
