import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadArticlesPageData, renderArticlesPage } from "../../page-data";
import { ARTICLES_DESCRIPTION, buildAlternates } from "@/lib/seo";
import { buildPageParams } from "@/lib/static-params";

export const revalidate = 604800; // weekly
const MAX_STATIC_PAGES = 15;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  if (IS_BUILD) return [];
  try {
    const { totalPages } = await loadArticlesPageData(1);
    return buildPageParams(totalPages, 1, MAX_STATIC_PAGES);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) return {};
  const title = pageNumber > 1 ? `Roblox Articles - Page ${pageNumber}` : "Roblox Articles";
  return {
    title,
    description: ARTICLES_DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(pageNumber === 1 ? "/articles" : `/articles/page/${pageNumber}`)
  };
}

export default async function ArticlesPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
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
