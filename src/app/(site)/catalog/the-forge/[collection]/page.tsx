import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { getCatalogPageContentByCodes, type CatalogFaqEntry } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";
import {
  BASE_PATH,
  buildForgeCatalogCodeCandidates,
  FORGE_CATALOGS,
  getForgeCatalogConfig,
  loadForgeCatalogDataset,
  renderForgeCatalogPage,
  type CatalogContentHtml
} from "../page-data";

export const revalidate = 86400;

type PageProps = {
  params: Promise<{ collection: string }>;
};

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

async function buildCatalogContent(codes: string[]): Promise<{ contentHtml: CatalogContentHtml | null }> {
  const catalog = await getCatalogPageContentByCodes(codes);
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

  const faqEntries: CatalogFaqEntry[] = Array.isArray(catalog.faq_json) ? catalog.faq_json : [];
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collection } = await params;
  const config = getForgeCatalogConfig(collection);
  const canonicalPath = config ? `${BASE_PATH}/${config.slug}` : `${BASE_PATH}/${collection}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!config) {
    return {
      title: `The Forge Catalog | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: { canonical }
    };
  }

  const dataset = await loadForgeCatalogDataset(config);
  const count = dataset.items.length;
  const fallbackTitle = `All ${count.toLocaleString("en-US")} ${config.label} in The Forge`;
  const catalog = await getCatalogPageContentByCodes(buildForgeCatalogCodeCandidates(config));
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? fallbackTitle;
  const description = catalog?.meta_description ?? config.description ?? CATALOG_DESCRIPTION;
  const image = catalog?.thumb_url ?? `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
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

export async function generateStaticParams() {
  return FORGE_CATALOGS.map((entry) => ({ collection: entry.slug }));
}

export default async function ForgeCatalogCollectionPage({ params }: PageProps) {
  const { collection } = await params;
  const config = getForgeCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  const [dataset, { contentHtml }] = await Promise.all([
    loadForgeCatalogDataset(config),
    buildCatalogContent(buildForgeCatalogCodeCandidates(config))
  ]);

  return renderForgeCatalogPage({ config, dataset, contentHtml });
}
