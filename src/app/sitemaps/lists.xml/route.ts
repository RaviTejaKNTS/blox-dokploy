import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type ListSitemapRow = {
  slug: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("game_lists")
      .select("slug, updated_at, refreshed_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as ListSitemapRow[];
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.slug) continue;
      const updated = row.refreshed_at ?? row.updated_at;
      pages.push({
        loc: withSiteUrl(`/lists/${row.slug}`),
        changefreq: "daily",
        priority: "0.7",
        lastmod: toIsoDate(updated)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build lists sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
