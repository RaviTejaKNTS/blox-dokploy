import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { loadRobloxMusicIdsPageData, renderRobloxMusicIdsPage } from "../../page-data";
import { CATALOG_DESCRIPTION } from "@/lib/seo";

export const revalidate = 2592000;

const CATALOG_CODE_CANDIDATES = ["roblox-music-ids"];

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Music IDs - Page ${pageNumber}` : "Roblox Music IDs";
  return {
    title,
    description: CATALOG_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: {
      canonical: pageNumber === 1 ? "/catalog/roblox-music-ids" : `/catalog/roblox-music-ids/page/${pageNumber}`
    }
  };
}

export default async function RobloxMusicIdsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const [pageData, catalog] = await Promise.all([
    loadRobloxMusicIdsPageData(pageNumber),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const { songs, total, totalPages } = pageData;
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1,
    contentHtml: catalog ? { id: catalog.id ?? null } : null
  });
}
