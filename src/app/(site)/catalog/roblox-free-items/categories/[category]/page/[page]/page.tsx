import type { Metadata } from "next";
import "@/styles/article-content.css";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  BASE_PATH,
  loadFreeItemCategoryBySlug,
  loadFreeItemSubcategories,
  loadFreeItemsPageData,
  renderRobloxFreeItemsPage
} from "../../../../page-data";

export const revalidate = 2592000;

const CATALOG_CODE_CANDIDATES = ["roblox-free-items"];

type PageProps = {
  params: Promise<{ category: string; page: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug, page } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const title = `Free Roblox ${category.label} items - Page ${safePageNumber}`;
  const description = `Browse free Roblox ${category.label} items (page ${safePageNumber}).`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/categories/${category.slug}/page/${safePageNumber}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: {
      index: false,
      follow: true,
      nocache: false,
      googleBot: {
        index: false,
        follow: true
      }
    },
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function RobloxFreeItemsCategoryPaginatedPage({ params }: PageProps) {
  const { category: categorySlug, page } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  const [subcategories, pageData, catalog] = await Promise.all([
    loadFreeItemSubcategories(category.label),
    loadFreeItemsPageData(safePageNumber, { category: category.label }),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const { items, total, totalPages } = pageData;

  const pageTitle = `Free Roblox ${category.label} items`;
  const basePath = `${BASE_PATH}/categories/${category.slug}`;

  return renderRobloxFreeItemsPage({
    items,
    total,
    totalPages,
    currentPage: safePageNumber,
    showHero: false,
    pageTitle,
    description: `Browse free Roblox ${category.label} items.`,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Catalog", href: "/catalog" },
      { label: "Roblox free items", href: BASE_PATH },
      { label: "Categories", href: `${BASE_PATH}/categories` },
      { label: category.label, href: basePath },
      { label: `Page ${safePageNumber}`, href: null }
    ],
    basePath,
    navActive: "categories",
    categorySlug: category.slug,
    categoryLabel: category.label,
    subcategories,
    contentHtml: catalog ? { id: catalog.id ?? null } : null
  });
}
