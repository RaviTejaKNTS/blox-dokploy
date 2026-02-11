import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCodesPageData, renderCodesPage } from "../../page-data";
import { CODES_DESCRIPTION, buildAlternates } from "@/lib/seo";

export const revalidate = 86400; // daily

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Game Codes - Page ${pageNumber}` : "Roblox Game Codes";
  return {
    title,
    description: CODES_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(pageNumber === 1 ? "/codes" : `/codes/page/${pageNumber}`)
  };
}

export default async function CodesPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { games, total, totalPages } = await loadCodesPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderCodesPage({
    games,
    totalGames: total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
