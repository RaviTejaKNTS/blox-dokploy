import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articlesMetadata, loadArticlesPageData, renderArticlesPage } from "./page-data";

export const revalidate = 604800; // weekly

export const metadata: Metadata = articlesMetadata;

export default async function ArticlesIndexPage() {
  const { articles, total, totalPages } = await loadArticlesPageData(1);
  if (!articles) {
    notFound();
  }

  return renderArticlesPage({
    articles,
    totalArticles: total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
