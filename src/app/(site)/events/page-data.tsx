import { formatDistanceToNow } from "date-fns";
import { markdownToPlainText } from "@/lib/markdown";
import { EVENTS_DESCRIPTION } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase";

const REVALIDATE_SECONDS = 3600;

type UniverseSummary = {
  universe_id: number;
  display_name: string | null;
  name: string | null;
  icon_url: string | null;
};

type EventsPageRow = {
  id: string;
  universe_id: number;
  slug: string | null;
  title: string;
  content_md: string | null;
  meta_description: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  universe?: UniverseSummary | null;
};

type EventsPageRowRaw = Omit<EventsPageRow, "universe"> & {
  universe?: UniverseSummary | UniverseSummary[] | null;
};

type EventThumbnail = {
  media_id: number | null;
  rank: number | null;
};

type VirtualEventRow = {
  event_id: string;
  universe_id: number;
  title: string | null;
  display_title: string | null;
  start_utc: string | null;
  end_utc: string | null;
  created_utc: string | null;
  updated_utc: string | null;
  event_status: string | null;
  thumbnails?: EventThumbnail[] | null;
};

type EventWithThumbnail = VirtualEventRow & {
  mediaIds: number[];
  primaryThumbnailUrl: string | null;
};

type EventBucket = "upcoming" | "current" | "past";

export type EventsPageCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  fallbackIcon: string | null;
  eventName: string | null;
  eventTimeLabel: string | null;
  status: "upcoming" | "current" | "past" | "none";
  counts: { upcoming: number; current: number; past: number };
  updatedLabel: string | null;
};

type RobloxThumbnailResponse = {
  data?: Array<{ targetId?: number; imageUrl?: string; state?: string }>;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : null;
}

function normalizeUniverse(value: UniverseSummary | UniverseSummary[] | null | undefined): UniverseSummary | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function sortByRank<T extends { rank?: number | null }>(items: T[] = []): T[] {
  return [...items].sort((a, b) => {
    const aRank = a.rank ?? Number.POSITIVE_INFINITY;
    const bRank = b.rank ?? Number.POSITIVE_INFINITY;
    return aRank - bRank;
  });
}

function getEventDisplayName(event: VirtualEventRow): string {
  return normalizeText(event.display_title) ?? normalizeText(event.title) ?? "Upcoming event";
}

function classifyEvents(events: EventWithThumbnail[]) {
  const now = Date.now();
  const current: EventWithThumbnail[] = [];
  const upcoming: EventWithThumbnail[] = [];
  const past: EventWithThumbnail[] = [];

  for (const event of events) {
    const startTime = parseDate(event.start_utc);
    const endTime = parseDate(event.end_utc);
    const status = event.event_status?.toLowerCase() ?? "";

    let bucket: EventBucket;
    if (status === "ended" || status === "cancelled") {
      bucket = "past";
    } else if (startTime !== null && startTime > now) {
      bucket = "upcoming";
    } else if (endTime !== null && endTime < now) {
      bucket = "past";
    } else {
      bucket = "current";
    }

    if (bucket === "current") current.push(event);
    if (bucket === "upcoming") upcoming.push(event);
    if (bucket === "past") past.push(event);
  }

  const sortByStartAsc = (a: VirtualEventRow, b: VirtualEventRow) => {
    const aStart = parseDate(a.start_utc) ?? Number.POSITIVE_INFINITY;
    const bStart = parseDate(b.start_utc) ?? Number.POSITIVE_INFINITY;
    return aStart - bStart;
  };
  const sortByStartDesc = (a: VirtualEventRow, b: VirtualEventRow) => {
    const aStart = parseDate(a.start_utc) ?? 0;
    const bStart = parseDate(b.start_utc) ?? 0;
    return bStart - aStart;
  };

  current.sort(sortByStartAsc);
  upcoming.sort(sortByStartAsc);
  past.sort(sortByStartDesc);

  return { current, upcoming, past };
}

function formatEventTimeLabel(bucket: EventBucket, event: VirtualEventRow): string | null {
  const startTime = parseDate(event.start_utc);
  const endTime = parseDate(event.end_utc);
  try {
    if (bucket === "upcoming" && startTime) {
      return `Starts ${formatDistanceToNow(new Date(startTime), { addSuffix: true })}`;
    }
    if (bucket === "current") {
      if (endTime) {
        return `Ends ${formatDistanceToNow(new Date(endTime), { addSuffix: true })}`;
      }
      if (startTime) {
        return `Started ${formatDistanceToNow(new Date(startTime), { addSuffix: true })}`;
      }
      return "Live now";
    }
    if (bucket === "past") {
      if (endTime) {
        return `Ended ${formatDistanceToNow(new Date(endTime), { addSuffix: true })}`;
      }
      if (startTime) {
        return `Started ${formatDistanceToNow(new Date(startTime), { addSuffix: true })}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function formatUpdatedLabel(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return null;
  }
}

function eventUpdateTimestamp(event: VirtualEventRow): number | null {
  const updated = parseDate(event.updated_utc);
  const created = parseDate(event.created_utc);
  if (updated === null && created === null) return null;
  if (updated === null) return created;
  if (created === null) return updated;
  return Math.max(updated, created);
}

function latestTimestamp(values: Array<number | null>): number | null {
  let latest: number | null = null;
  for (const value of values) {
    if (typeof value !== "number") continue;
    if (latest === null || value > latest) {
      latest = value;
    }
  }
  return latest;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, Math.max(0, maxLength - 1));
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxLength - 40) {
    return `${slice.slice(0, lastSpace)}…`;
  }
  return `${slice}…`;
}

function summarizePage(page: EventsPageRow, universeName: string | null): string {
  const meta = normalizeText(page.meta_description);
  if (meta) return meta;
  const content = page.content_md ? normalizeText(markdownToPlainText(page.content_md)) : null;
  const fallback = universeName
    ? `Upcoming, live, and past events for ${universeName}.`
    : EVENTS_DESCRIPTION;
  if (!content) return fallback;
  return truncateText(content, 170);
}

function chunkArray<T>(input: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
}

async function fetchThumbnailUrls(mediaIds: number[]): Promise<Map<number, string>> {
  if (!mediaIds.length) return new Map();
  const unique = Array.from(new Set(mediaIds));
  const chunks = chunkArray(unique, 100);
  const urlMap = new Map<number, string>();

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      assetIds: chunk.join(","),
      size: "768x432",
      format: "Png",
      isCircular: "false"
    });

    try {
      const res = await fetch(`https://thumbnails.roblox.com/v1/assets?${params.toString()}`, {
        next: { revalidate: REVALIDATE_SECONDS }
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as RobloxThumbnailResponse;
      for (const item of payload.data ?? []) {
        if (typeof item.targetId === "number" && typeof item.imageUrl === "string") {
          urlMap.set(item.targetId, item.imageUrl);
        }
      }
    } catch {
      continue;
    }
  }

  return urlMap;
}

async function loadEventsPages(limit?: number): Promise<EventsPageRow[]> {
  const sb = supabaseAdmin();
  let query = sb
    .from("events_pages")
    .select(
      "id, universe_id, slug, title, content_md, meta_description, is_published, published_at, created_at, updated_at, universe:roblox_universes(universe_id, display_name, name, icon_url)"
    )
    .eq("is_published", true)
    .not("slug", "is", null)
    .order("updated_at", { ascending: false });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map((row) => {
    const raw = row as EventsPageRowRaw;
    return {
      ...raw,
      universe: normalizeUniverse(raw.universe)
    };
  });
}

async function loadEventsForUniverses(universeIds: number[]): Promise<VirtualEventRow[]> {
  if (!universeIds.length) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, title, display_title, start_utc, end_utc, created_utc, updated_utc, event_status, thumbnails:roblox_virtual_event_thumbnails(media_id, rank)"
    )
    .in("universe_id", universeIds);

  if (error) throw error;
  return (data ?? []) as VirtualEventRow[];
}

function buildEventMedia(events: VirtualEventRow[]) {
  const withMedia: EventWithThumbnail[] = events.map((event) => {
    const mediaIds = sortByRank(event.thumbnails ?? [])
      .map((entry) => entry.media_id)
      .filter((entry): entry is number => typeof entry === "number")
      .slice(0, 4);

    return {
      ...event,
      mediaIds,
      primaryThumbnailUrl: null
    };
  });

  return withMedia;
}

function pickCoverEvent(
  grouped: ReturnType<typeof classifyEvents>
): { event: EventWithThumbnail; bucket: EventBucket } | null {
  const upcoming = grouped.upcoming.find((event) => event.primaryThumbnailUrl);
  if (upcoming) return { event: upcoming, bucket: "upcoming" };

  const current = grouped.current.find((event) => event.primaryThumbnailUrl);
  if (current) return { event: current, bucket: "current" };

  const past = grouped.past.find((event) => event.primaryThumbnailUrl);
  if (past) return { event: past, bucket: "past" };

  const fallbackUpcoming = grouped.upcoming[0];
  if (fallbackUpcoming) return { event: fallbackUpcoming, bucket: "upcoming" };
  const fallbackCurrent = grouped.current[0];
  if (fallbackCurrent) return { event: fallbackCurrent, bucket: "current" };
  const fallbackPast = grouped.past[0];
  if (fallbackPast) return { event: fallbackPast, bucket: "past" };

  return null;
}

export async function buildEventsCards(
  limit?: number
): Promise<{ cards: EventsPageCardData[]; total: number; refreshedLabel: string | null }> {
  const pages = await loadEventsPages(limit);
  if (!pages.length) {
    return { cards: [], total: 0, refreshedLabel: null };
  }

  const universeIds = Array.from(new Set(pages.map((page) => page.universe_id).filter((id) => Number.isFinite(id))));
  const events = await loadEventsForUniverses(universeIds);
  const eventsWithMedia = buildEventMedia(events);
  const allMediaIds = eventsWithMedia.flatMap((event) => event.mediaIds);
  const mediaMap = await fetchThumbnailUrls(allMediaIds);

  const eventsWithThumbnails = eventsWithMedia.map((event) => {
    const primaryThumbnailUrl = event.mediaIds
      .map((mediaId) => mediaMap.get(mediaId))
      .find((entry): entry is string => typeof entry === "string") ?? null;
    return {
      ...event,
      primaryThumbnailUrl
    };
  });

  const eventsByUniverse = new Map<number, EventWithThumbnail[]>();
  for (const event of eventsWithThumbnails) {
    const list = eventsByUniverse.get(event.universe_id) ?? [];
    list.push(event);
    eventsByUniverse.set(event.universe_id, list);
  }

  let latestUpdated: number | null = null;
  const cards: EventsPageCardData[] = pages
    .filter((page): page is EventsPageRow & { slug: string } => Boolean(page.slug))
    .map((page) => {
      const universeName = page.universe?.display_name ?? page.universe?.name ?? null;
      const summary = summarizePage(page, universeName);
      const universeEvents = eventsByUniverse.get(page.universe_id) ?? [];
      const grouped = classifyEvents(universeEvents);
      const coverPick = pickCoverEvent(grouped);
      const status: EventsPageCardData["status"] = coverPick?.bucket ?? "none";
      const pageUpdated = parseDate(page.updated_at || page.published_at || page.created_at || null);
      const eventsUpdated = latestTimestamp(universeEvents.map(eventUpdateTimestamp));
      const updatedAt = latestTimestamp([pageUpdated, eventsUpdated]);
      if (typeof updatedAt === "number") {
        latestUpdated = latestUpdated === null ? updatedAt : Math.max(latestUpdated, updatedAt);
      }

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        summary,
        universeName,
        coverImage: coverPick?.event.primaryThumbnailUrl ?? null,
        fallbackIcon: page.universe?.icon_url ?? null,
        eventName: coverPick ? getEventDisplayName(coverPick.event) : null,
        eventTimeLabel: coverPick ? formatEventTimeLabel(coverPick.bucket, coverPick.event) : null,
        status,
        counts: {
          upcoming: grouped.upcoming.length,
          current: grouped.current.length,
          past: grouped.past.length
        },
        updatedLabel: formatUpdatedLabel(updatedAt)
      };
    });

  return {
    cards,
    total: cards.length,
    refreshedLabel:
      typeof latestUpdated === "number" ? formatDistanceToNow(new Date(latestUpdated), { addSuffix: true }) : null
  };
}
