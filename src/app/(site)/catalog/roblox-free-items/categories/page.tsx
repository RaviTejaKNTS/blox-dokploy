import type { Metadata } from "next";
import "@/styles/article-content.css";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  buildCategoryCards,
  buildSimpleItemListSchema,
  FreeItemsBreadcrumb,
  FreeItemsNav,
  loadFreeItemCategories
} from "../page-data";

export const revalidate = 2592000;

const PAGE_TITLE = "Roblox free item categories";
const PAGE_DESCRIPTION = "Browse free Roblox catalog items by category.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/categories`;
  return {
    title: `${PAGE_TITLE} | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION
    }
  };
}

export default async function RobloxFreeItemsCategoriesPage() {
  const categories = await loadFreeItemCategories();
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/categories`;

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox free items", href: BASE_PATH },
    { label: "Categories", href: null }
  ];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox free items", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Categories", url: canonicalUrl }
    ])
  );

  const listSchema = buildSimpleItemListSchema({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: canonicalUrl,
    items: categories.map((category) => ({
      name: category.label,
      url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/categories/${category.slug}`
    }))
  });

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <FreeItemsBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{PAGE_TITLE}</h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">{PAGE_DESCRIPTION}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {categories.length.toLocaleString("en-US")} categories
          </span>
        </div>
      </header>

      <CatalogAdSlot />

      <FreeItemsNav active="categories" />

      {buildCategoryCards(categories)}

      <CatalogAdSlot />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
