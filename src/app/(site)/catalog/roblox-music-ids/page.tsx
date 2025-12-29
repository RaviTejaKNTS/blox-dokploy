import type { Metadata } from "next";
import { CATALOG_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { CANONICAL, loadRobloxMusicIdsPageData, parseMusicIdFilters, renderRobloxMusicIdsPage } from "./page-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Roblox Music IDs | ${SITE_NAME}`,
  description: CATALOG_DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: `Roblox Music IDs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Music IDs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION
  }
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RobloxMusicIdsPage({ searchParams }: { searchParams?: SearchParams }) {
  const filters = parseMusicIdFilters(searchParams);
  const { songs, total, totalPages } = await loadRobloxMusicIdsPageData(1, filters);

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    filters
  });
}
