import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type ChecklistSitemapRow = {
  slug: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("checklist_pages")
      .select("slug, updated_at, published_at")
      .eq("is_public", true)
      .not("slug", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as ChecklistSitemapRow[];
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.slug) continue;
      const updated = row.updated_at ?? row.published_at;
      pages.push({
        loc: withSiteUrl(`/checklists/${row.slug}`),
        changefreq: "weekly",
        priority: "0.7",
        lastmod: toIsoDate(updated)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build checklists sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
