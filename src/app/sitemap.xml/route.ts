import { buildSitemapIndexXml, withSiteUrl } from "@/lib/sitemap";
import { NextResponse } from "next/server";

const SITEMAP_PATHS = [
  "/sitemaps/main.xml",
  "/sitemaps/codes.xml",
  "/sitemaps/articles.xml",
  "/sitemaps/lists.xml",
  "/sitemaps/tools.xml",
  "/sitemaps/checklists.xml",
  "/sitemaps/quizzes.xml",
  "/sitemaps/events.xml",
  "/sitemaps/authors.xml",
  "/sitemaps/catalog.xml"
];

export async function GET() {
  const entries = SITEMAP_PATHS.map((path) => ({
    loc: withSiteUrl(path)
  }));
  const xml = buildSitemapIndexXml(entries);
  return new NextResponse(xml, {
    headers: { "content-type": "application/xml" }
  });
}
