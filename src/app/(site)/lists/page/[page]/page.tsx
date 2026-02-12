import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadListsPageData, renderListsPage } from "../../page-data";
import { LISTS_DESCRIPTION, buildAlternates } from "@/lib/seo";
import { buildPageParams } from "@/lib/static-params";

export const revalidate = 86400; // daily
const MAX_STATIC_PAGES = 10;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  const { totalPages } = await loadListsPageData(1);
  return buildPageParams(totalPages, 1, MAX_STATIC_PAGES);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Game Lists - Page ${pageNumber}` : "Roblox Game Lists";
  return {
    title,
    description: LISTS_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(pageNumber === 1 ? "/lists" : `/lists/page/${pageNumber}`)
  };
}

export default async function ListsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { cards, total, totalPages } = await loadListsPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderListsPage({
    cards,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
