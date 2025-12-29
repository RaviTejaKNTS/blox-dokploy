import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { ArticleCard } from "@/components/ArticleCard";
import { ChecklistCard } from "@/components/ChecklistCard";
import { ContentSlot } from "@/components/ContentSlot";
import { GameCard } from "@/components/GameCard";
import { SocialShare } from "@/components/SocialShare";
import { ToolCard } from "@/components/ToolCard";
import {
  listPublishedArticlesByUniverseId,
  listPublishedChecklistsByUniverseId,
  listGamesWithActiveCountsByUniverseId
} from "@/lib/db";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { supabaseAdmin } from "@/lib/supabase";
import { CHECKLISTS_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";
import { listPublishedToolsByUniverseId, type ToolListEntry } from "@/lib/tools";
import { EventTimePanel } from "./EventTimePanel";

export const revalidate = 3600;

type PageProps = {
  params: { slug: string };
};

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
  seo_title: string | null;
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

type EventCategory = {
  category: string | null;
  rank: number | null;
};

type EventThumbnail = {
  media_id: number | null;
  rank: number | null;
};

type VirtualEvent = {
  event_id: string;
  universe_id: number;
  place_id: number | null;
  title: string | null;
  display_title: string | null;
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
  event_summary_md: string | null;
  event_details_md: string | null;
  guide_slug: string | null;
  categories?: EventCategory[] | null;
  thumbnails?: EventThumbnail[] | null;
};

type UpcomingEventView = VirtualEvent & {
  summary_html: string | null;
  details_html: string | null;
  primary_thumbnail_url: string | null;
};

const UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short"
});

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeUniverse(value: UniverseSummary | UniverseSummary[] | null | undefined): UniverseSummary | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatUtcDateTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return UTC_FORMATTER.format(date);
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function eventUpdateTimestamp(event: VirtualEvent): number | null {
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

function formatLabel(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getEventDisplayName(event: VirtualEvent): string {
  return normalizeText(event.display_title) ?? normalizeText(event.title) ?? "Upcoming event";
}

function getEventNameForTitle(event: VirtualEvent): string | null {
  return normalizeText(event.display_title) ?? normalizeText(event.title);
}

function buildDynamicTitle(gameName: string, upcomingEventName: string | null): string {
  if (upcomingEventName) {
    return `When is Next ${gameName} Update? [${upcomingEventName}]`;
  }
  return `When is Next ${gameName} Update?`;
}

function sortByRank<T extends { rank?: number | null }>(items: T[] = []): T[] {
  return [...items].sort((a, b) => {
    const aRank = a.rank ?? Number.POSITIVE_INFINITY;
    const bRank = b.rank ?? Number.POSITIVE_INFINITY;
    return aRank - bRank;
  });
}

type RobloxThumbnailResponse = {
  data?: Array<{ targetId?: number; imageUrl?: string; state?: string }>;
};

async function fetchThumbnailUrls(mediaIds: number[]): Promise<Map<number, string>> {
  if (!mediaIds.length) return new Map();
  const params = new URLSearchParams({
    assetIds: mediaIds.join(","),
    size: "768x432",
    format: "Png",
    isCircular: "false"
  });

  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/assets?${params.toString()}`, {
      next: { revalidate }
    });
    if (!res.ok) return new Map();
    const payload = (await res.json()) as RobloxThumbnailResponse;
    const map = new Map<number, string>();
    for (const item of payload.data ?? []) {
      if (typeof item.targetId === "number" && typeof item.imageUrl === "string") {
        map.set(item.targetId, item.imageUrl);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function classifyEvents(events: VirtualEvent[]) {
  const now = Date.now();
  const current: VirtualEvent[] = [];
  const upcoming: VirtualEvent[] = [];
  const past: VirtualEvent[] = [];

  for (const event of events) {
    const startTime = parseDate(event.start_utc);
    const endTime = parseDate(event.end_utc);
    const status = event.event_status?.toLowerCase() ?? "";

    let bucket: "current" | "upcoming" | "past";
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

  const sortByStartAsc = (a: VirtualEvent, b: VirtualEvent) => {
    const aStart = parseDate(a.start_utc) ?? Number.POSITIVE_INFINITY;
    const bStart = parseDate(b.start_utc) ?? Number.POSITIVE_INFINITY;
    return aStart - bStart;
  };
  const sortByStartDesc = (a: VirtualEvent, b: VirtualEvent) => {
    const aStart = parseDate(a.start_utc) ?? 0;
    const bStart = parseDate(b.start_utc) ?? 0;
    return bStart - aStart;
  };

  current.sort(sortByStartAsc);
  upcoming.sort(sortByStartAsc);
  past.sort(sortByStartDesc);

  return { current, upcoming, past };
}

async function loadEventsPage(slug: string): Promise<EventsPageRow | null> {
  const sb = supabaseAdmin();
  const normalized = slug.trim().toLowerCase();
  const { data, error } = await sb
    .from("events_pages")
    .select(
      "id, universe_id, slug, title, content_md, seo_title, meta_description, is_published, published_at, created_at, updated_at, universe:roblox_universes(universe_id, display_name, name, icon_url)"
    )
    .eq("slug", normalized)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const raw = data as EventsPageRowRaw;
  return {
    ...raw,
    universe: normalizeUniverse(raw.universe)
  };
}

async function loadEvents(universeId: number): Promise<VirtualEvent[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_virtual_events")
    .select(
      "event_id, universe_id, place_id, title, display_title, start_utc, end_utc, created_utc, updated_utc, event_status, event_visibility, featuring_status, all_thumbnails_created, host_name, host_has_verified_badge, host_type, host_id, event_summary_md, event_details_md, guide_slug, categories:roblox_virtual_event_categories(category, rank), thumbnails:roblox_virtual_event_thumbnails(media_id, rank)"
    )
    .eq("universe_id", universeId)
    .order("start_utc", { ascending: true });

  if (error) throw error;
  return (data ?? []) as VirtualEvent[];
}

async function loadEventsForMetadata(universeId: number): Promise<VirtualEvent[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_virtual_events")
    .select("event_id, title, display_title, start_utc, end_utc, event_status")
    .eq("universe_id", universeId);

  if (error) throw error;
  return (data ?? []) as VirtualEvent[];
}

async function hydrateUpcoming(events: VirtualEvent[]): Promise<UpcomingEventView[]> {
  const hydrated = await Promise.all(
    events.map(async (event) => {
      const summary_md = normalizeText(event.event_summary_md);
      const details_md = normalizeText(event.event_details_md);
      const summary_html = summary_md ? await renderMarkdown(summary_md) : null;
      const details_html = details_md ? await renderMarkdown(details_md) : null;
      const mediaIds = sortByRank(event.thumbnails ?? [])
        .map((entry) => entry.media_id)
        .filter((entry): entry is number => typeof entry === "number");
      const primaryMediaId = mediaIds[0] ?? null;
      let primary_thumbnail_url: string | null = null;
      if (typeof primaryMediaId === "number") {
        const urlMap = await fetchThumbnailUrls([primaryMediaId]);
        primary_thumbnail_url = urlMap.get(primaryMediaId) ?? null;
      }
      return {
        ...event,
        summary_html,
        details_html,
        primary_thumbnail_url
      };
    })
  );
  return hydrated;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await loadEventsPage(params.slug);
  if (!page) return {};

  const universeName = page.universe?.display_name ?? page.universe?.name ?? "this game";
  const metadataEvents = await loadEventsForMetadata(page.universe_id);
  const metadataUpcoming = classifyEvents(metadataEvents).upcoming;
  const metadataFirstUpcoming = metadataUpcoming[0] ? getEventNameForTitle(metadataUpcoming[0]) : null;
  const dynamicTitle = buildDynamicTitle(universeName, metadataFirstUpcoming);
  const seoTitle = normalizeText(page.seo_title) ? resolveSeoTitle(page.seo_title) ?? page.seo_title : dynamicTitle;
  const description =
    normalizeText(page.meta_description) ||
    (page.content_md ? markdownToPlainText(page.content_md).slice(0, 160) : `Current, upcoming, and past events for ${universeName}.`);
  const canonical = `${SITE_URL}/events/${page.slug}`;

  return {
    title: seoTitle ? `${seoTitle} | ${SITE_NAME}` : SITE_NAME,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: seoTitle ?? SITE_NAME,
      description,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle ?? SITE_NAME,
      description
    }
  };
}

function EventFacts({ event }: { event: VirtualEvent }) {
  const statusLabel = formatLabel(event.event_status);
  const visibilityLabel = formatLabel(event.event_visibility);
  const featuringLabel = formatLabel(event.featuring_status);
  const hostLabel = event.host_name ? `${event.host_name}${event.host_type ? ` (${event.host_type})` : ""}` : null;
  const startLabel = formatUtcDateTime(event.start_utc) ?? "TBA";
  const endLabel = formatUtcDateTime(event.end_utc) ?? "TBA";
  const createdLabel = formatUtcDateTime(event.created_utc);
  const updatedLabel = formatUtcDateTime(event.updated_utc);

  return (
    <dl className="grid gap-3 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <dt className="font-semibold uppercase tracking-wide text-foreground/70">Starts (UTC)</dt>
        <dd className="mt-1 text-foreground">{startLabel}</dd>
      </div>
      <div>
        <dt className="font-semibold uppercase tracking-wide text-foreground/70">Ends (UTC)</dt>
        <dd className="mt-1 text-foreground">{endLabel}</dd>
      </div>
      {statusLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Status</dt>
          <dd className="mt-1 text-foreground">{statusLabel}</dd>
        </div>
      ) : null}
      {visibilityLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Visibility</dt>
          <dd className="mt-1 text-foreground">{visibilityLabel}</dd>
        </div>
      ) : null}
      {featuringLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Featuring</dt>
          <dd className="mt-1 text-foreground">{featuringLabel}</dd>
        </div>
      ) : null}
      {hostLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Host</dt>
          <dd className="mt-1 text-foreground">{hostLabel}</dd>
        </div>
      ) : null}
      {typeof event.place_id === "number" ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Place ID</dt>
          <dd className="mt-1 text-foreground">{event.place_id}</dd>
        </div>
      ) : null}
      <div>
        <dt className="font-semibold uppercase tracking-wide text-foreground/70">Event ID</dt>
        <dd className="mt-1 text-foreground">{event.event_id}</dd>
      </div>
      {createdLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Created (UTC)</dt>
          <dd className="mt-1 text-foreground">{createdLabel}</dd>
        </div>
      ) : null}
      {updatedLabel ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-foreground/70">Updated (UTC)</dt>
          <dd className="mt-1 text-foreground">{updatedLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function CategoryChips({ event }: { event: VirtualEvent }) {
  const categories = sortByRank(event.categories ?? [])
    .map((entry) => entry.category)
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  if (!categories.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <span
          key={category}
          className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground"
        >
          {category}
        </span>
      ))}
    </div>
  );
}

async function ThumbnailGrid({ event, limit = 4 }: { event: VirtualEvent; limit?: number }) {
  const mediaIds = sortByRank(event.thumbnails ?? [])
    .map((entry) => entry.media_id)
    .filter((entry): entry is number => typeof entry === "number")
    .slice(0, limit);

  if (!mediaIds.length) return null;

  const urlMap = await fetchThumbnailUrls(mediaIds);
  const thumbnails = mediaIds
    .map((mediaId) => ({ mediaId, url: urlMap.get(mediaId) }))
    .filter((entry): entry is { mediaId: number; url: string } => typeof entry.url === "string");

  if (!thumbnails.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {thumbnails.map(({ mediaId, url }) => (
        <div
          key={mediaId}
          className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-surface-muted"
        >
          <Image
            src={url}
            alt="Event media"
            fill
            sizes="(max-width: 768px) 50vw, 320px"
            className="object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

function EventGuideLink({ guideSlug }: { guideSlug: string | null }) {
  if (!guideSlug) return null;
  return (
    <Link
      href={`/articles/${guideSlug}`}
      className="text-xs font-semibold uppercase tracking-wide text-accent underline-offset-4 hover:underline"
    >
      Event guide
    </Link>
  );
}

function UpcomingEventBlock({ event, gameName }: { event: UpcomingEventView; gameName: string }) {
  const eventName = getEventDisplayName(event);

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-[2rem] font-semibold leading-[1.15] text-foreground">
            {eventName} Event: Release Date and Time, Countdown and What to Expect
          </h2>
          <EventGuideLink guideSlug={event.guide_slug} />
        </div>
        {event.summary_html ? (
          <div
            className="prose dark:prose-invert max-w-none game-copy"
            dangerouslySetInnerHTML={{ __html: event.summary_html }}
          />
        ) : null}
      </header>

      <div className="space-y-4">
        <h3 className="text-[1.6rem] font-semibold leading-[1.2] text-foreground">
          When is the {eventName} start time
        </h3>
        <EventTimePanel
          startUtc={event.start_utc}
          endUtc={event.end_utc}
          gameName={gameName}
          eventName={eventName}
          thumbnailUrl={event.primary_thumbnail_url}
        />
      </div>


      {event.details_html ? (
        <div className="space-y-4">
          <h3 className="text-[1.6rem] font-semibold leading-[1.2] text-foreground">
            What to expect from {eventName}
          </h3>
          <div
            className="prose dark:prose-invert max-w-none game-copy"
            dangerouslySetInnerHTML={{ __html: event.details_html }}
          />
        </div>
      ) : null}
    </section>
  );
}

function CurrentEventCard({ event }: { event: VirtualEvent }) {
  const eventName = getEventDisplayName(event);
  const startLabel = formatUtcDateTime(event.start_utc) ?? "TBA";
  const endLabel = formatUtcDateTime(event.end_utc) ?? "TBA";
  const statusLabel = formatLabel(event.event_status);
  const visibilityLabel = formatLabel(event.event_visibility);

  return (
    <article className="rounded-2xl border border-border/60 bg-surface/60 p-5 shadow-soft leading-normal">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xl font-semibold text-foreground">{eventName}</h3>
        <EventGuideLink guideSlug={event.guide_slug} />
      </div>
      <div className="mt-3 grid gap-3 text-xs text-muted sm:grid-cols-2">
        <div>
          <span className="font-semibold uppercase tracking-wide text-foreground/70">Starts (UTC)</span>
          <p className="text-foreground">{startLabel}</p>
        </div>
        <div>
          <span className="font-semibold uppercase tracking-wide text-foreground/70">Ends (UTC)</span>
          <p className="text-foreground">{endLabel}</p>
        </div>
        {statusLabel ? (
          <div>
            <span className="font-semibold uppercase tracking-wide text-foreground/70">Status</span>
            <p className="text-foreground">{statusLabel}</p>
          </div>
        ) : null}
        {visibilityLabel ? (
          <div>
            <span className="font-semibold uppercase tracking-wide text-foreground/70">Visibility</span>
            <p className="text-foreground">{visibilityLabel}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <CategoryChips event={event} />
      </div>
    </article>
  );
}

function PastEventsTable({ events }: { events: VirtualEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-surface-muted/60 p-6">
        <div className="prose dark:prose-invert game-copy max-w-none">
          <p>No past events listed yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-scroll-wrapper">
      <div className="table-scroll-inner game-copy">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th className="table-col-compact">Starts (UTC)</th>
              <th className="table-col-compact">Ends (UTC)</th>
              <th className="table-col-compact">Status</th>
              <th className="table-col-compact">Guide</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const eventName = getEventDisplayName(event);
              const startLabel = formatUtcDateTime(event.start_utc) ?? "TBA";
              const endLabel = formatUtcDateTime(event.end_utc) ?? "TBA";
              const statusLabel = formatLabel(event.event_status) ?? "Unknown";
              return (
                <tr key={event.event_id}>
                  <td className="font-semibold text-foreground">{eventName}</td>
                  <td>{startLabel}</td>
                  <td>{endLabel}</td>
                  <td>{statusLabel}</td>
                  <td>
                    {event.guide_slug ? (
                      <Link
                        href={`/articles/${event.guide_slug}`}
                        className="text-xs font-semibold uppercase tracking-wide text-accent underline-offset-4 hover:underline"
                      >
                        Guide
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function EventsPage({ params }: PageProps) {
  const page = await loadEventsPage(params.slug);
  if (!page) {
    notFound();
  }

  const universeName = page.universe?.display_name ?? page.universe?.name ?? "this game";
  const events = await loadEvents(page.universe_id);
  const grouped = classifyEvents(events);
  const upcomingEvents = await hydrateUpcoming(grouped.upcoming);
  const firstUpcomingName = upcomingEvents[0] ? getEventNameForTitle(upcomingEvents[0]) : null;
  const dynamicTitle = buildDynamicTitle(universeName, firstUpcomingName);
  const headingTitle = normalizeText(page.title) ?? dynamicTitle;
  const introHtml = page.content_md ? await renderMarkdown(page.content_md) : null;
  const universeId = page.universe_id;
  const universeLabel = page.universe?.display_name ?? page.universe?.name ?? universeName;
  const canonicalUrl = `${SITE_URL}/events/${page.slug}`;
  const pageUpdated = parseDate(page.updated_at ?? page.published_at ?? page.created_at);
  const eventsUpdated = latestTimestamp(events.map(eventUpdateTimestamp));
  const updatedTimestamp = latestTimestamp([pageUpdated, eventsUpdated]);
  const updatedDate = typeof updatedTimestamp === "number" ? new Date(updatedTimestamp) : null;
  const formattedUpdated = updatedDate
    ? updatedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    : null;
  const updatedRelativeLabel = updatedDate ? formatDistanceToNow(updatedDate, { addSuffix: true }) : null;

  const relatedChecklists = universeId ? await listPublishedChecklistsByUniverseId(universeId, 1) : [];
  const relatedCodes = universeId ? await listGamesWithActiveCountsByUniverseId(universeId, 1) : [];
  const relatedArticles = universeId ? await listPublishedArticlesByUniverseId(universeId, 5, 0) : [];
  const relatedTools: ToolListEntry[] = universeId ? await listPublishedToolsByUniverseId(universeId, 3) : [];
  const relatedHeading = relatedArticles.length ? `${universeLabel} articles` : null;
  const relatedChecklistCards = relatedChecklists.map((row) => {
    const summaryPlain =
      markdownToPlainText(row.seo_description ?? row.description_md ?? "") || CHECKLISTS_DESCRIPTION;
    const itemsCount =
      typeof row.leaf_item_count === "number"
        ? row.leaf_item_count
        : typeof row.item_count === "number"
          ? row.item_count
          : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: summaryPlain,
      universeName: row.universe?.display_name ?? row.universe?.name ?? null,
      coverImage: row.universe?.icon_url ?? `${SITE_URL}/og-image.png`,
      updatedAt: row.updated_at || row.published_at || row.created_at || null,
      itemsCount
    };
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="min-w-0">
        <header className="mb-6 space-y-3">
          <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.25em] text-muted">
            <ol className="flex flex-wrap items-center gap-2">
              {[
                { label: "Home", href: "/" },
                { label: "Events", href: null },
                { label: universeName, href: null }
              ].map((item, index, items) => (
                <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="font-semibold text-muted transition hover:text-accent">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground/80">{item.label}</span>
                  )}
                  {index < items.length - 1 ? <span className="text-muted/60">&gt;</span> : null}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">{headingTitle}</h1>
          {formattedUpdated ? (
            <div className="flex flex-col gap-3 text-sm text-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground/80">
                  Updated on <span className="font-semibold text-foreground">{formattedUpdated}</span>
                  {updatedRelativeLabel ? <span>{' '}({updatedRelativeLabel})</span> : null}
                </span>
              </div>
            </div>
          ) : null}
        </header>
        {introHtml ? (
          <article
            className="prose dark:prose-invert max-w-none game-copy mb-10"
            dangerouslySetInnerHTML={{ __html: introHtml }}
          />
        ) : null}
        {upcomingEvents.length > 0 ? (
          <div className="prose dark:prose-invert max-w-none game-copy mb-8">
            <p>
              {upcomingEvents.length === 1
                ? `Right now, there is 1 upcoming event for ${universeName}.`
                : `Right now, there are ${upcomingEvents.length} upcoming events for ${universeName}.`}
            </p>
          </div>
        ) : null}

        <div className="space-y-10">
          <section className="space-y-6">
            {upcomingEvents.length ? (
              <div className="space-y-10">
                {upcomingEvents.map((event) => (
                  <UpcomingEventBlock key={event.event_id} event={event} gameName={universeName} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-surface-muted/60 p-6">
                <div className="prose dark:prose-invert game-copy max-w-none">
                  <p>No upcoming events are listed yet.</p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Live now</p>
                <h2 className="text-[2rem] font-semibold leading-[1.15] text-foreground">Current events</h2>
              </div>
              <span className="text-xs text-muted">{grouped.current.length} active</span>
            </div>
            {grouped.current.length ? (
              <div className="grid gap-6 md:grid-cols-2">
                {grouped.current.map((event) => (
                  <CurrentEventCard key={event.event_id} event={event} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-surface-muted/60 p-6">
                <div className="prose dark:prose-invert game-copy max-w-none">
                  <p>No current events listed right now.</p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Archive</p>
                <h2 className="text-[2rem] font-semibold leading-[1.15] text-foreground">Past events</h2>
              </div>
              <span className="text-xs text-muted">{grouped.past.length} events</span>
            </div>
            <PastEventsTable events={grouped.past} />
          </section>
        </div>
      </article>

      <aside className="space-y-4">
        <section className="space-y-3">
          <SocialShare url={canonicalUrl} title={headingTitle} heading="Share this page" />
        </section>
        <ContentSlot
          slot="4767824441"
          className="w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
          minHeight="clamp(280px, 40vw, 600px)"
        />

        {relatedCodes.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Codes for {universeLabel}</h3>
            <div className="grid gap-3">
              {relatedCodes.map((g) => (
                <GameCard key={g.id} game={g} titleAs="p" />
              ))}
            </div>
          </section>
        ) : null}

        {relatedChecklistCards.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{universeLabel} checklist</h3>
            <div className="space-y-3">
              {relatedChecklistCards.map((card) => (
                <ChecklistCard key={card.id} {...card} />
              ))}
            </div>
          </section>
        ) : null}

        {relatedArticles.length ? (
          <section className="space-y-3">
            {relatedHeading ? <h3 className="text-lg font-semibold text-foreground">{relatedHeading}</h3> : null}
            <div className="space-y-4">
              {relatedArticles.map((item) => (
                <ArticleCard key={item.id} article={item} />
              ))}
            </div>
          </section>
        ) : null}

        {relatedTools.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Tools for {universeLabel}</h3>
            <div className="space-y-4">
              {relatedTools.map((tool) => (
                <ToolCard key={tool.id ?? tool.code} tool={tool} />
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
