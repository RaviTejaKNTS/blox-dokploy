import type { Metadata } from "next";
import { loadCodesPageData, renderCodesPage, codesMetadata } from "./page-data";

export const revalidate = 86400; // daily

export const metadata: Metadata = codesMetadata;

export default async function CodesIndexPage() {
  const { games, total, totalPages } = await loadCodesPageData(1);

  return renderCodesPage({
    games,
    totalGames: total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
