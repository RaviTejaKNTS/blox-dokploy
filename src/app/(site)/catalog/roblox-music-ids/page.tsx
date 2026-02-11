import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
  CANONICAL,
  loadRobloxMusicIdsPageData,
  renderRobloxMusicIdsPage,
  type CatalogContentHtml
} from "./page-data";

export const revalidate = 2592000;

const CATALOG_CODE_CANDIDATES = ["roblox-music-ids"];
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

function sortDescriptionEntries(description: Record<string, string> | null | undefined) {
  return Object.entries(description ?? {}).sort((a, b) => {
    const left = Number.parseInt(a[0], 10);
    const right = Number.parseInt(b[0], 10);
    if (Number.isNaN(left) && Number.isNaN(right)) return a[0].localeCompare(b[0]);
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

async function buildCatalogContent(): Promise<{ contentHtml: CatalogContentHtml | null }> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  if (!catalog) {
    return { contentHtml: null };
  }

  const introHtml = catalog.intro_md ? await renderMarkdown(catalog.intro_md, { paragraphizeLineBreaks: true }) : "";
  const howHtml = catalog.how_it_works_md ? await renderMarkdown(catalog.how_it_works_md, { paragraphizeLineBreaks: true }) : "";

  const descriptionEntries = sortDescriptionEntries(catalog.description_json ?? {});
  const descriptionHtml = await Promise.all(
    descriptionEntries.map(async ([key, value]) => ({
      key,
      html: await renderMarkdown(value ?? "", { paragraphizeLineBreaks: true })
    }))
  );

  const faqEntries = Array.isArray(catalog.faq_json) ? catalog.faq_json : [];
  const faqHtml = await Promise.all(
    faqEntries.map(async (entry) => ({
      q: entry.q,
      a: await renderMarkdown(entry.a ?? "", { paragraphizeLineBreaks: true })
    }))
  );

  return {
    contentHtml: {
      id: catalog.id ?? null,
      title: catalog.title ?? null,
      introHtml,
      howHtml,
      descriptionHtml,
      faqHtml,
      updatedAt: catalog.content_updated_at ?? catalog.updated_at ?? catalog.published_at ?? catalog.created_at ?? null,
      ctaLabel: catalog.cta_label ?? null,
      ctaUrl: catalog.cta_url ?? null
    }
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  if (!catalog) {
    return {
      title: `Roblox Music IDs | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: buildAlternates(CANONICAL)
    };
  }

  const title = resolveSeoTitle(catalog.seo_title) ?? catalog.title ?? `Roblox Music IDs | ${SITE_NAME}`;
  const description = catalog.meta_description ?? CATALOG_DESCRIPTION;
  const image = catalog.thumb_url || FALLBACK_IMAGE;

  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: {
      type: "website",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function RobloxMusicIdsPage() {
  const [{ songs, total, totalPages }, { contentHtml }] = await Promise.all([
    loadRobloxMusicIdsPageData(1),
    buildCatalogContent()
  ]);

  return renderRobloxMusicIdsPage({
    songs,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    contentHtml
  });
}
