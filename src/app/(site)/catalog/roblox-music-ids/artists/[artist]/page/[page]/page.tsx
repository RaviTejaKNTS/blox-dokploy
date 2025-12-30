import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  MusicIdGrid,
  buildMusicItemListSchema,
  loadArtistMusicIdsPageData,
  loadArtistOptionBySlug
} from "../../../../page-data";

export const revalidate = 2592000;

type PageProps = {
  params: { artist: string; page: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  return {
    title: `Artist Music IDs - Page ${pageNumber} | ${SITE_NAME}`,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_PATH}/artists/${params.artist}/page/${pageNumber}`
    }
  };
}

export default async function ArtistMusicIdsPaginatedPage({ params }: PageProps) {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const artist = await loadArtistOptionBySlug(params.artist);
  if (!artist) {
    notFound();
  }

  const { songs, total, totalPages } = await loadArtistMusicIdsPageData(pageNumber, artist.label);
  if (pageNumber > totalPages) {
    notFound();
  }

  const description = `Roblox music IDs credited to ${artist.label}.`;
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = `${BASE_PATH}/artists/${artist.slug}/page/${pageNumber}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = `${artist.label} Roblox music IDs - Page ${pageNumber}`;
  const updatedIso = latest ? latest.toISOString() : new Date().toISOString();
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Artists", href: `${BASE_PATH}/artists` },
    { label: artist.label, href: `${BASE_PATH}/artists/${artist.slug}` },
    { label: `Page ${pageNumber}`, href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Artists", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/artists` },
      { name: artist.label, url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/artists/${artist.slug}` },
      { name: `Page ${pageNumber}`, url: canonicalUrl }
    ])
  );
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    songs,
    total,
    startIndex: (pageNumber - 1) * 24
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
      <header className="space-y-2">
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-3xl font-semibold text-foreground">{artist.label} Roblox music IDs</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold uppercase tracking-wide text-accent">
            {total.toLocaleString("en-US")} songs
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
              Updated {refreshedLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      </header>

      <MusicCatalogNav active="artists" />

      <MusicIdGrid songs={songs} />

      <PagePagination
        basePath={`${BASE_PATH}/artists/${artist.slug}`}
        currentPage={pageNumber}
        totalPages={totalPages}
      />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
