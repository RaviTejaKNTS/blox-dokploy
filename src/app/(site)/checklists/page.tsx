import { notFound } from "next/navigation";
import { CHECKLISTS_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadChecklistsPageData, renderChecklistsPage } from "./page-data";

export const revalidate = 21600; // 6 hours

export const metadata = {
  title: `Roblox Checklists | ${SITE_NAME}`,
  description: CHECKLISTS_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/checklists`)
};

export default async function ChecklistsPage() {
  const { cards, total, totalPages } = await loadChecklistsPageData(1);
  if (!cards) {
    notFound();
  }

  return renderChecklistsPage({
    cards,
    total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
