import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type EventsSitemapRow = {
  slug: string | null;
  updated_at: string | null;
  published_at: string | null;
  universe_id: number | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("events_pages")
      .select("slug, updated_at, published_at, universe_id")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as EventsSitemapRow[];
    const universeIds = Array.from(
      new Set(rows.map((row) => row.universe_id).filter((id): id is number => typeof id === "number"))
    );
    const universeUpdated = new Map<number, string>();

    if (universeIds.length) {
      const { data: eventUpdates, error: updatesError } = await sb
        .from("roblox_virtual_events")
        .select("universe_id, updated_utc")
        .in("universe_id", universeIds)
        .not("updated_utc", "is", null);

      if (updatesError) throw updatesError;

      for (const row of (eventUpdates ?? []) as Array<{ universe_id?: number | null; updated_utc?: string | null }>) {
        const id = row.universe_id;
        const updated = row.updated_utc;
        if (typeof id !== "number" || !updated) continue;
        const current = universeUpdated.get(id);
        if (!current || updated > current) {
          universeUpdated.set(id, updated);
        }
      }
    }

    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.slug) continue;
      const eventUpdated = row.universe_id ? universeUpdated.get(row.universe_id) ?? null : null;
      const updated = eventUpdated && row.updated_at && eventUpdated > row.updated_at
        ? eventUpdated
        : row.updated_at ?? eventUpdated ?? row.published_at;
      pages.push({
        loc: withSiteUrl(`/events/${row.slug}`),
        changefreq: "daily",
        priority: "0.8",
        lastmod: toIsoDate(updated)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build events sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
