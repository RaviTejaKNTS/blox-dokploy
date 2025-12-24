import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadRobloxMusicIdsPageData, parseMusicIdFilters, renderRobloxMusicIdsPage } from "../../page";
import { CATALOG_DESCRIPTION } from "@/lib/seo";

export const revalidate = 3600;

type PageProps = {
  params: { page: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pageNumber = Number(params.page);
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

export default async function RobloxMusicIdsPaginatedPage({ params, searchParams }: PageProps) {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const filters = parseMusicIdFilters(searchParams);
  const { songs, total, totalPages } = await loadRobloxMusicIdsPageData(pageNumber, filters);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1,
    filters
  });
}
