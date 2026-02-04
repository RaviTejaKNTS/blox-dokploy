import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type GameSitemapRow = {
  slug: string | null;
  updated_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("games")
      .select("slug, updated_at")
      .eq("is_published", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as GameSitemapRow[];
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.slug) continue;
      pages.push({
        loc: withSiteUrl(`/codes/${row.slug}`),
        changefreq: "weekly",
        priority: "0.7",
        lastmod: toIsoDate(row.updated_at)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build codes sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
