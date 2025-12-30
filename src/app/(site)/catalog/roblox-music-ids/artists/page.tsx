import type { Metadata } from "next";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  buildArtistCards,
  buildSimpleItemListSchema,
  loadPagedArtistOptions
} from "../page-data";

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: `Music ID Artists | ${SITE_NAME}`,
  description: "Browse Roblox music IDs organized by artist.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/catalog/roblox-music-ids/artists"
  }
};

export default async function MusicIdArtistsPage() {
  const { options: artists, total, totalPages } = await loadPagedArtistOptions(1);
  const description = "Browse Roblox music IDs organized by artist.";
  const canonicalPath = `${BASE_PATH}/artists`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = "Roblox music ID artists";
  const updatedIso = new Date().toISOString();
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Artists", href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Artists", url: canonicalUrl }
    ])
  );
  const listSchema = buildSimpleItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    items: artists.map((artist) => ({
      name: artist.label,
      url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/artists/${artist.slug}`
    })),
    itemType: "MusicGroup"
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
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Roblox music ID artists</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Explore every artist name in our catalog and pull their Roblox music IDs.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total.toLocaleString("en-US")} artists tracked
          </span>
        </div>
      </header>

      <MusicCatalogNav active="artists" />

      {buildArtistCards(artists)}

      <PagePagination basePath={`${BASE_PATH}/artists`} currentPage={1} totalPages={totalPages} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
