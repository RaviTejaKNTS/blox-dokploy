import { buildSitemapUrlSetXml, toIsoDate, type SitemapUrlSetEntry, withSiteUrl } from "@/lib/sitemap";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

type QuizSitemapRow = {
  code: string | null;
  updated_at: string | null;
  published_at: string | null;
  content_updated_at?: string | null;
};

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("quiz_pages_view")
      .select("code, updated_at, published_at, content_updated_at")
      .eq("is_published", true)
      .not("code", "is", null)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as QuizSitemapRow[];
    const pages: SitemapUrlSetEntry[] = [];
    for (const row of rows) {
      if (!row.code) continue;
      const updated = row.content_updated_at ?? row.updated_at ?? row.published_at;
      pages.push({
        loc: withSiteUrl(`/quizzes/${row.code}`),
        changefreq: "weekly",
        priority: "0.9",
        lastmod: toIsoDate(updated)
      });
    }

    return new NextResponse(buildSitemapUrlSetXml(pages), {
      headers: { "content-type": "application/xml" }
    });
  } catch (error) {
    console.error("Failed to build quizzes sitemap", error);
    return new NextResponse(buildSitemapUrlSetXml([]), {
      headers: { "content-type": "application/xml" }
    });
  }
}
