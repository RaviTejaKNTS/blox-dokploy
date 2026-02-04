import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type CatalogSitemapRow = {
  code: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("catalog_pages")
      .select("code, updated_at, published_at")
      .eq("is_published", true)
      .not("code", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as CatalogSitemapRow[];
    const pageMap = new Map<string, SitemapUrlSetEntry>();

    for (const row of rows) {
      const code = row.code?.trim();
      if (!code) continue;

      const path = `/catalog/${code}`;
      const updated = row.updated_at ?? row.published_at;
      pageMap.set(path, {
        loc: withSiteUrl(path),
        changefreq: "weekly",
        priority: "0.7",
        lastmod: toIsoDate(updated)
      });
    }

    const pages = Array.from(pageMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build catalog sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
