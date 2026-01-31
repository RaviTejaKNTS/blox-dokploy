import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadToolsPageData, renderToolsPage } from "../../page-data";
import { TOOLS_DESCRIPTION } from "@/lib/seo";

export const revalidate = 21600; // 6 hours

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Tools & Calculators - Page ${pageNumber}` : "Roblox Tools & Calculators";
  return {
    title,
    description: TOOLS_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: {
      canonical: pageNumber === 1 ? "/tools" : `/tools/page/${pageNumber}`
    }
  };
}

export default async function ToolsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { tools, total, totalPages } = await loadToolsPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderToolsPage({
    tools,
    total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
