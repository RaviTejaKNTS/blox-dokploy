import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadChecklistsPageData, renderChecklistsPage } from "../../page-data";
import { CHECKLISTS_DESCRIPTION, buildAlternates } from "@/lib/seo";
import { buildPageParams } from "@/lib/static-params";

export const revalidate = 21600; // 6 hours
const MAX_STATIC_PAGES = 10;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  const { totalPages } = await loadChecklistsPageData(1);
  return buildPageParams(totalPages, 1, MAX_STATIC_PAGES);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Checklists - Page ${pageNumber}` : "Roblox Checklists";
  return {
    title,
    description: CHECKLISTS_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(pageNumber === 1 ? "/checklists" : `/checklists/page/${pageNumber}`)
  };
}

export default async function ChecklistsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { cards, total, totalPages } = await loadChecklistsPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderChecklistsPage({
    cards,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
