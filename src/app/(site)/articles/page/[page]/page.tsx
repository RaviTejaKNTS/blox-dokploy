import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadArticlesPageData, renderArticlesPage } from "../../page-data";
import { ARTICLES_DESCRIPTION } from "@/lib/seo";

export const revalidate = 604800; // weekly

type PageProps = {
  params: { page: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Articles - Page ${pageNumber}` : "Roblox Articles";
  return {
    title,
    description: ARTICLES_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: {
      canonical: pageNumber === 1 ? "/articles" : `/articles/page/${pageNumber}`
    }
  };
}

export default async function ArticlesPaginatedPage({ params }: PageProps) {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const { articles, total, totalPages } = await loadArticlesPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderArticlesPage({
    articles,
    totalArticles: total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
