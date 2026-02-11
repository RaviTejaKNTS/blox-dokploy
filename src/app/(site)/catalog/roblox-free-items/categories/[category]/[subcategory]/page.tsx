import type { Metadata } from "next";
import "@/styles/article-content.css";
import { notFound } from "next/navigation";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  loadFreeItemCategoryBySlug,
  loadFreeItemSubcategories,
  loadFreeItemSubcategoryBySlug,
  loadFreeItemsPageData,
  renderRobloxFreeItemsPage
} from "../../../page-data";

export const revalidate = 2592000;

const CATALOG_CODE_CANDIDATES = ["roblox-free-items"];

type PageProps = {
  params: Promise<{ category: string; subcategory: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const subcategory = await loadFreeItemSubcategoryBySlug(category.label, subcategorySlug);
  if (!subcategory) {
    return {
      title: `Roblox free items | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION
    };
  }

  const title = `Free Roblox ${subcategory.label} items`;
  const description = `Browse free Roblox ${subcategory.label} items in the ${category.label} category.`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/categories/${category.slug}/${subcategory.slug}`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    alternates: buildAlternates(canonical),
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

export default async function RobloxFreeItemsSubcategoryPage({ params }: PageProps) {
  const { category: categorySlug, subcategory: subcategorySlug } = await params;
  const category = await loadFreeItemCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const subcategory = await loadFreeItemSubcategoryBySlug(category.label, subcategorySlug);
  if (!subcategory) {
    notFound();
  }

  const [subcategories, pageData, catalog] = await Promise.all([
    loadFreeItemSubcategories(category.label),
    loadFreeItemsPageData(1, { category: category.label, subcategory: subcategory.label }),
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
  ]);
  const { items, total, totalPages } = pageData;

  const pageTitle = `Free Roblox ${subcategory.label} items`;
  const description = `Browse free Roblox ${subcategory.label} items in the ${category.label} category.`;
  const basePath = `${BASE_PATH}/categories/${category.slug}/${subcategory.slug}`;

  return renderRobloxFreeItemsPage({
    items,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    pageTitle,
    description,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Catalog", href: "/catalog" },
      { label: "Roblox free items", href: BASE_PATH },
      { label: "Categories", href: `${BASE_PATH}/categories` },
      { label: category.label, href: `${BASE_PATH}/categories/${category.slug}` },
      { label: subcategory.label, href: null }
    ],
    basePath,
    navActive: "categories",
    categorySlug: category.slug,
    categoryLabel: category.label,
    subcategories,
    activeSubcategorySlug: subcategory.slug,
    contentHtml: catalog ? { id: catalog.id ?? null } : null
  });
}
