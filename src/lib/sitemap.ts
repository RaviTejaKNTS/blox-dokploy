import { SITE_URL } from "@/lib/seo";

export type SitemapUrlSetEntry = {
  loc: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
};

export type SitemapIndexEntry = {
  loc: string;
  lastmod?: string;
};

export type MainSitemapRoute = {
  path: string;
  changefreq: string;
  priority: string;
};

export const MAIN_SITEMAP_ROUTES: MainSitemapRoute[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/codes", changefreq: "daily", priority: "0.7" },
  { path: "/articles", changefreq: "weekly", priority: "0.9" },
  { path: "/lists", changefreq: "weekly", priority: "0.7" },
  { path: "/tools", changefreq: "weekly", priority: "0.9" },
  { path: "/checklists", changefreq: "weekly", priority: "0.9" },
  { path: "/events", changefreq: "weekly", priority: "0.8" },
  { path: "/authors", changefreq: "monthly", priority: "0.3" },
  { path: "/catalog", changefreq: "weekly", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/how-we-gather-and-verify-codes", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.5" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.5" },
  { path: "/editorial-guidelines", changefreq: "monthly", priority: "0.5" },
  { path: "/disclaimer", changefreq: "monthly", priority: "0.5" }
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function withSiteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL.replace(/\/$/, "")}${normalizedPath}`;
}

export function toIsoDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function buildSitemapUrlSetXml(entries: SitemapUrlSetEntry[]) {
  const body = entries
    .map((entry) => {
      const loc = escapeXml(entry.loc);
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<url><loc>${loc}</loc>${lastmod}<changefreq>${escapeXml(entry.changefreq)}</changefreq><priority>${escapeXml(entry.priority)}</priority></url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function buildSitemapIndexXml(entries: SitemapIndexEntry[]) {
  const body = entries
    .map((entry) => {
      const loc = escapeXml(entry.loc);
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<sitemap><loc>${loc}</loc>${lastmod}</sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}
