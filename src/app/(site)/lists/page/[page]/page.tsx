import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadListsPageData, renderListsPage } from "../../page";

export const revalidate = 86400; // daily

type PageProps = {
  params: { page: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Game Lists - Page ${pageNumber}` : "Roblox Game Lists";
  return {
    title,
    description: "Paginated Roblox game lists index",
    robots: { index: false, follow: true },
    alternates: {
      canonical: pageNumber === 1 ? "/lists" : `/lists/page/${pageNumber}`
    }
  };
}

export default async function ListsPaginatedPage({ params }: PageProps) {
  const pageNumber = Number(params.page);
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
