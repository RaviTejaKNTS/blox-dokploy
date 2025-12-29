import { notFound } from "next/navigation";
import { LISTS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadListsPageData, renderListsPage } from "./page-data";

export const revalidate = 86400; // daily

export const metadata = {
  title: `Roblox Game Lists | ${SITE_NAME}`,
  description: LISTS_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/lists`
  }
};

export default async function ListsPage() {
  const { cards, total, totalPages } = await loadListsPageData(1);
  if (!cards) {
    notFound();
  }

  return renderListsPage({
    cards,
    total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
