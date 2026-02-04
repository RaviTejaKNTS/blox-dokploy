import { MAIN_SITEMAP_ROUTES, buildSitemapUrlSetXml, withSiteUrl } from "@/lib/sitemap";
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6 hours

export async function GET() {
  const pages = MAIN_SITEMAP_ROUTES.map((route) => ({
    loc: withSiteUrl(route.path),
    changefreq: route.changefreq,
    priority: route.priority
  }));

  return new NextResponse(buildSitemapUrlSetXml(pages), {
    headers: { "content-type": "application/xml" }
  });
}
