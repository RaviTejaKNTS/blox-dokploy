import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type ToolSitemapRow = {
  code: string | null;
  updated_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("tools")
      .select("code, updated_at")
      .eq("is_published", true)
      .not("code", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as ToolSitemapRow[];
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.code) continue;
      pages.push({
        loc: withSiteUrl(`/tools/${row.code}`),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(row.updated_at)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build tools sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
