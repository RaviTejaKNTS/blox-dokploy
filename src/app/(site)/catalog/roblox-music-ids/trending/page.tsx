import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  TrendingMusicList,
  buildMusicItemListSchema,
  loadTrendingMusicIdsPageData
} from "../page-data";

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: `Trending Music IDs | ${SITE_NAME}`,
  description: "Ranked Roblox music IDs sorted by the latest top chart data.",
  robots: { index: false, follow: true },
  alternates: buildAlternates(`${BASE_PATH}/trending`)
};

export default async function TrendingMusicIdsPage() {
  const description = "Ranked Roblox music IDs sorted by the latest top chart data.";
  const { songs, total, totalPages } = await loadTrendingMusicIdsPageData(1);
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = `${BASE_PATH}/trending`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = "Trending Roblox music IDs";
  const updatedIso = latest ? latest.toISOString() : new Date().toISOString();
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Trending", href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Trending", url: canonicalUrl }
    ])
  );
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    songs,
    total,
    startIndex: 0
  });
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: updatedIso,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Trending Roblox music IDs</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Ranked songs pulled from Roblox music charts so you can grab the hottest IDs first.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total.toLocaleString("en-US")} ranked songs
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Updated {refreshedLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">24 per page</span>
        </div>
      </header>

      <CatalogAdSlot />

      <MusicCatalogNav active="trending" />

      <TrendingMusicList songs={songs} />

      <PagePagination basePath={`${BASE_PATH}/trending`} currentPage={1} totalPages={totalPages} />

      <CatalogAdSlot />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
