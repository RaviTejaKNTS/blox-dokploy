import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 21600; // 6 hours

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  updatedAtMs: number;
};

type ArticleRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type GameRow = {
  slug: string | null;
  name: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type ChecklistRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type EventsRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type ListRow = {
  slug: string | null;
  title: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
};

const FEED_LIMIT = 120;
const FEED_DESCRIPTION = "Latest Roblox codes, guides, checklists, rankings, and event updates from Bloxodes.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toFeedItem(input: {
  title: string;
  path: string;
  description: string;
  updatedAt?: string | null;
  publishedAt?: string | null;
}): FeedItem {
  const date = toDate(input.updatedAt) ?? toDate(input.publishedAt) ?? new Date();
  return {
    title: input.title,
    link: `${SITE_URL.replace(/\/$/, "")}${input.path}`,
    description: input.description,
    pubDate: date.toUTCString(),
    updatedAtMs: date.getTime()
  };
}

async function loadFeedItems(): Promise<FeedItem[]> {
  const sb = supabaseAdmin();
  const [articlesRes, gamesRes, checklistsRes, eventsRes, listsRes] = await Promise.all([
    sb
      .from("articles")
      .select("slug, title, updated_at, published_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(60),
    sb
      .from("games")
      .select("slug, name, updated_at, published_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(60),
    sb
      .from("checklist_pages")
      .select("slug, title, updated_at, published_at")
      .eq("is_public", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    sb
      .from("events_pages")
      .select("slug, title, updated_at, published_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    sb
      .from("game_lists")
      .select("slug, title, updated_at, refreshed_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40)
  ]);

  const firstError =
    articlesRes.error || gamesRes.error || checklistsRes.error || eventsRes.error || listsRes.error;
  if (firstError) {
    throw firstError;
  }

  const items: FeedItem[] = [];

  for (const article of (articlesRes.data ?? []) as ArticleRow[]) {
    if (!article.slug || !article.title) continue;
    items.push(
      toFeedItem({
        title: article.title,
        path: `/articles/${article.slug}`,
        description: "Roblox article and guide update.",
        updatedAt: article.updated_at,
        publishedAt: article.published_at
      })
    );
  }

  for (const game of (gamesRes.data ?? []) as GameRow[]) {
    if (!game.slug || !game.name) continue;
    items.push(
      toFeedItem({
        title: `${game.name} Codes`,
        path: `/codes/${game.slug}`,
        description: `Active and expired code updates for ${game.name}.`,
        updatedAt: game.updated_at,
        publishedAt: game.published_at
      })
    );
  }

  for (const checklist of (checklistsRes.data ?? []) as ChecklistRow[]) {
    if (!checklist.slug || !checklist.title) continue;
    items.push(
      toFeedItem({
        title: checklist.title,
        path: `/checklists/${checklist.slug}`,
        description: "Checklist update.",
        updatedAt: checklist.updated_at,
        publishedAt: checklist.published_at
      })
    );
  }

  for (const eventsPage of (eventsRes.data ?? []) as EventsRow[]) {
    if (!eventsPage.slug || !eventsPage.title) continue;
    items.push(
      toFeedItem({
        title: eventsPage.title,
        path: `/events/${eventsPage.slug}`,
        description: "Event schedule and status update.",
        updatedAt: eventsPage.updated_at,
        publishedAt: eventsPage.published_at
      })
    );
  }

  for (const list of (listsRes.data ?? []) as ListRow[]) {
    if (!list.slug || !list.title) continue;
    items.push(
      toFeedItem({
        title: list.title,
        path: `/lists/${list.slug}`,
        description: "Live ranking list update.",
        updatedAt: list.refreshed_at ?? list.updated_at,
        publishedAt: list.updated_at
      })
    );
  }

  return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, FEED_LIMIT);
}

function buildRssXml(items: FeedItem[]): string {
  const now = new Date().toUTCString();
  const lastBuildDate = items[0]?.pubDate ?? now;
  const channelLink = SITE_URL.replace(/\/$/, "");
  const feedLink = `${channelLink}/feed.xml`;

  const xmlItems = items
    .map((item) => {
      const link = escapeXml(item.link);
      return `<item><title>${escapeXml(item.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${escapeXml(item.pubDate)}</pubDate><description>${escapeXml(item.description)}</description></item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(SITE_NAME)}</title>
<link>${escapeXml(channelLink)}</link>
<description>${escapeXml(FEED_DESCRIPTION)}</description>
<atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml" />
<language>en-us</language>
<lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
${xmlItems}
</channel>
</rss>`;
}

export async function GET() {
  try {
    const items = await loadFeedItems();
    return new NextResponse(buildRssXml(items), {
      headers: { "content-type": "application/rss+xml; charset=utf-8" }
    });
  } catch (error) {
    console.error("Failed to build RSS feed", error);
    return new NextResponse(buildRssXml([]), {
      headers: { "content-type": "application/rss+xml; charset=utf-8" }
    });
  }
}
