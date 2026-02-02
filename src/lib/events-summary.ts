import { formatDistanceToNow } from "date-fns";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

type EventBucket = "upcoming" | "current" | "past";

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
};

export type UniverseEventSummary = {
  counts: { upcoming: number; current: number; past: number };
  featured: { name: string; timeLabel: string | null; status: EventBucket } | null;
};

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length ? trimmed : null;
}

function getEventDisplayName(event: VirtualEventRow): string {
  return normalizeText(event.display_title) ?? normalizeText(event.title) ?? "Upcoming event";
}

function classifyEvents(events: VirtualEventRow[]) {
  const now = Date.now();
  const current: VirtualEventRow[] = [];
  const upcoming: VirtualEventRow[] = [];
  const past: VirtualEventRow[] = [];

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

function pickFeaturedEvent(grouped: ReturnType<typeof classifyEvents>) {
  const upcoming = grouped.upcoming[0];
  if (upcoming) return { event: upcoming, bucket: "upcoming" as const };
  const current = grouped.current[0];
  if (current) return { event: current, bucket: "current" as const };
  const past = grouped.past[0];
  if (past) return { event: past, bucket: "past" as const };
  return null;
}

export async function getUniverseEventSummary(universeId: number): Promise<UniverseEventSummary | null> {
  const cacheKey = `universeEventSummary:${universeId}`;
  const cached = unstable_cache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("roblox_virtual_events")
        .select(
          "event_id, universe_id, title, display_title, start_utc, end_utc, created_utc, updated_utc, event_status"
        )
        .eq("universe_id", universeId);

      if (error) throw error;
      const events = (data ?? []) as VirtualEventRow[];
      if (!events.length) {
        return {
          counts: { upcoming: 0, current: 0, past: 0 },
          featured: null
        } as UniverseEventSummary;
      }

      const grouped = classifyEvents(events);
      const featuredPick = pickFeaturedEvent(grouped);
      const featured = featuredPick
        ? {
            name: getEventDisplayName(featuredPick.event),
            timeLabel: formatEventTimeLabel(featuredPick.bucket, featuredPick.event),
            status: featuredPick.bucket
          }
        : null;

      return {
        counts: {
          upcoming: grouped.upcoming.length,
          current: grouped.current.length,
          past: grouped.past.length
        },
        featured
      } as UniverseEventSummary;
    },
    [cacheKey],
    {
      revalidate: 3600,
      tags: ["events-pages"]
    }
  );

  return cached();
}
