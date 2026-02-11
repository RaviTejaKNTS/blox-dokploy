import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  buildGenreCards,
  buildSimpleItemListSchema,
  loadPagedGenreOptions
} from "../../../page-data";

export const revalidate = 2592000;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  return {
    title: `Music ID Genres - Page ${pageNumber} | ${SITE_NAME}`,
    robots: { index: false, follow: true },
    alternates: buildAlternates(`${BASE_PATH}/genres/page/${pageNumber}`)
  };
}

export default async function MusicIdGenresPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { options: genres, total, totalPages } = await loadPagedGenreOptions(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  const description = "Browse Roblox music IDs organized by genre.";
  const canonicalPath = `${BASE_PATH}/genres/page/${pageNumber}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = `Roblox music ID genres - Page ${pageNumber}`;
  const updatedIso = new Date().toISOString();
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Genres", href: `${BASE_PATH}/genres` },
    { label: `Page ${pageNumber}`, href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Genres", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/genres` },
      { name: `Page ${pageNumber}`, url: canonicalUrl }
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
      <header className="space-y-2">
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-3xl font-semibold text-foreground">Roblox music ID genres</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold uppercase tracking-wide text-accent">
            {total.toLocaleString("en-US")} genres tracked
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      </header>

      <CatalogAdSlot />

      <MusicCatalogNav active="genres" />

      {buildGenreCards(genres)}

      <PagePagination basePath={`${BASE_PATH}/genres`} currentPage={pageNumber} totalPages={totalPages} />

      <CatalogAdSlot />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
