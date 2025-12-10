import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const buildXml = (pages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }>) => {
  const body = pages
    .map(
      (p) =>
        `<url><loc>${p.loc}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
};

async function buildSitemapResponse() {
  try {
    const sb = supabaseAdmin();
    const origin = "https://bloxodes.com";

    const [
      { data: games },
      { data: authors },
      { data: articles },
      { data: lists },
      { data: tools },
      { data: checklists }
    ] = await Promise.all([
      sb
        .from("games")
        .select("slug, updated_at")
        .eq("is_published", true)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false }),
      sb
        .from("authors")
        .select("slug, updated_at")
        .not("slug", "is", null)
        .order("updated_at", { ascending: false }),
      sb
        .from("articles")
        .select("slug, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false }),
      sb
        .from("game_lists")
        .select("slug, updated_at, refreshed_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false }),
      sb
        .from("tools")
        .select("code, updated_at")
        .eq("is_published", true)
        .order("updated_at", { ascending: false }),
      sb
        .from("checklist_pages")
        .select("slug, updated_at, published_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
    ]);

    const pages: Array<{ loc: string; changefreq: string; priority: string; lastmod?: string }> = [
      { loc: `${origin}/`, changefreq: "daily", priority: "1.0" }
    ];

    const staticRoutes: Array<{ path: string; changefreq: string; priority: string }> = [
      { path: "/about", changefreq: "monthly", priority: "0.6" },
      { path: "/how-we-gather-and-verify-codes", changefreq: "monthly", priority: "0.6" },
      { path: "/contact", changefreq: "monthly", priority: "0.6" },
      { path: "/privacy-policy", changefreq: "yearly", priority: "0.5" },
      { path: "/editorial-guidelines", changefreq: "monthly", priority: "0.5" },
      { path: "/disclaimer", changefreq: "monthly", priority: "0.5" },
      { path: "/authors", changefreq: "monthly", priority: "0.6" },
      { path: "/tools", changefreq: "weekly", priority: "0.8" },
      { path: "/articles", changefreq: "weekly", priority: "0.7" }
    ];

    for (const route of staticRoutes) {
      pages.push({
        loc: `${origin}${route.path}`,
        changefreq: route.changefreq,
        priority: route.priority
      });
    }

    for (const g of games || []) {
      if (!g?.slug) continue;
      pages.push({
        loc: `${origin}/codes/${g.slug}`,
        changefreq: "weekly",
        priority: "0.9",
        lastmod: g.updated_at ? new Date(g.updated_at).toISOString() : undefined
      });
    }

    for (const author of authors || []) {
      if (!author?.slug) continue;
      pages.push({
        loc: `${origin}/authors/${author.slug}`,
        changefreq: "monthly",
        priority: "0.5",
        lastmod: author.updated_at ? new Date(author.updated_at).toISOString() : undefined
      });
    }

    for (const article of articles || []) {
      if (!article?.slug) continue;
      pages.push({
        loc: `${origin}/articles/${article.slug}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: article.updated_at ? new Date(article.updated_at).toISOString() : undefined
      });
    }

    for (const list of lists || []) {
      if (!list?.slug) continue;
      const updated = (list as any).refreshed_at ?? (list as any).updated_at;
      pages.push({
        loc: `${origin}/lists/${list.slug}`,
        changefreq: "daily",
        priority: "0.7",
        lastmod: updated ? new Date(updated).toISOString() : undefined
      });
    }

    for (const tool of tools || []) {
      if (!tool?.code) continue;
      pages.push({
        loc: `${origin}/tools/${tool.code}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: tool.updated_at ? new Date(tool.updated_at).toISOString() : undefined
      });
    }

    for (const checklist of checklists || []) {
      if (!checklist?.slug) continue;
      const updated = (checklist as any).updated_at ?? (checklist as any).published_at;
      pages.push({
        loc: `${origin}/checklists/${checklist.slug}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: updated ? new Date(updated).toISOString() : undefined
      });
    }

    const xml = buildXml(pages);
    return new NextResponse(xml, { headers: { "content-type": "application/xml" } });
  } catch (error) {
    console.error("Failed to build sitemap", error);
    const xml = buildXml([{ loc: "https://bloxodes.com/", changefreq: "daily", priority: "1.0" }]);
    return new NextResponse(xml, { headers: { "content-type": "application/xml" }, status: 200 });
  }
}

export async function GET() {
  return buildSitemapResponse();
}
