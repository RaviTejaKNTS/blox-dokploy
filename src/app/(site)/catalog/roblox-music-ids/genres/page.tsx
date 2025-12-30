import type { Metadata } from "next";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  buildGenreCards,
  buildSimpleItemListSchema,
  loadPagedGenreOptions
} from "../page-data";

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: `Music ID Genres | ${SITE_NAME}`,
  description: "Browse Roblox music IDs organized by genre.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "/catalog/roblox-music-ids/genres"
  }
};

export default async function MusicIdGenresPage() {
  const { options: genres, total, totalPages } = await loadPagedGenreOptions(1);
  const description = "Browse Roblox music IDs organized by genre.";
  const canonicalPath = `${BASE_PATH}/genres`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = "Roblox music ID genres";
  const updatedIso = new Date().toISOString();
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Genres", href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Genres", url: canonicalUrl }
    ])
  );
  const listSchema = buildSimpleItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    items: genres.map((genre) => ({
      name: genre.label,
      url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/genres/${genre.slug}`
    })),
    itemType: "DefinedTerm"
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
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Roblox music ID genres</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Jump into a genre to explore every Roblox music ID we have tagged for that sound.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total.toLocaleString("en-US")} genres tracked
          </span>
        </div>
      </header>

      <MusicCatalogNav active="genres" />

      {buildGenreCards(genres)}

      <PagePagination basePath={`${BASE_PATH}/genres`} currentPage={1} totalPages={totalPages} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
