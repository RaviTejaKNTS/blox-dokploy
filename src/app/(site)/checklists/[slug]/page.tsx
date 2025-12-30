import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { ChecklistProgressHeader } from "@/components/ChecklistProgressHeader";
import { ChecklistFooterLinks } from "@/components/ChecklistFooterLinks";
import { getChecklistPageBySlug } from "@/lib/db";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { CHECKLISTS_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";

export const revalidate = 3600; // 1 hour

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getChecklistPageBySlug(params.slug);
  if (!data) return {};

  const { page } = data;
  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title;
  const description =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : CHECKLISTS_DESCRIPTION);
  const canonical = `${SITE_URL}/checklists/${page.slug}`;
  const publishedTime = page.published_at ? new Date(page.published_at).toISOString() : undefined;
  const updatedTime = page.updated_at ? new Date(page.updated_at).toISOString() : undefined;

  return {
    title: `${titleBase} | ${SITE_NAME}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: titleBase,
      description,
      siteName: SITE_NAME,
      publishedTime,
      modifiedTime: updatedTime
    },
    twitter: {
      card: "summary",
      title: titleBase,
      description
    }
  };
}

export default async function ChecklistPage({ params }: PageProps) {
  const data = await getChecklistPageBySlug(params.slug);
  if (!data) {
    notFound();
  }

  const { page, items } = data;
  const canonicalUrl = `${SITE_URL}/checklists/${page.slug}`;
  const descriptionPlain =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : CHECKLISTS_DESCRIPTION);
  const coverImage = page.universe?.icon_url || `${SITE_URL}/og-image.png`;
  const descriptionHtml = page.description_md ? await renderMarkdown(page.description_md) : null;
  const leafItems = items.filter((item) => item.section_code.split(".").filter(Boolean).length === 3);
  const latestItemUpdated = items.reduce<Date | null>((latest, item) => {
    const dt = item.updated_at ? new Date(item.updated_at) : null;
    if (!dt) return latest;
    if (!latest || dt > latest) return dt;
    return latest;
  }, null);
  const publishedDate = page.published_at ? new Date(page.published_at) : new Date(page.created_at);
  const updatedDate = latestItemUpdated && latestItemUpdated > new Date(page.updated_at)
    ? latestItemUpdated
    : new Date(page.updated_at);
  const itemListElements = leafItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Thing",
      name: item.title,
      ...(item.description ? { description: item.description } : {}),
      identifier: item.section_code
    }
  }));
  const webApplicationSchema = {
    "@type": "WebApplication",
    name: `${page.title} Checklist`,
    url: canonicalUrl,
    description: descriptionPlain,
    operatingSystem: "Web",
    applicationCategory: "UtilityApplication",
    image: coverImage
  };
  const itemListSchema = {
    "@type": "ItemList",
    name: `${page.title} Checklist Items`,
    description: descriptionPlain,
    url: canonicalUrl,
    datePublished: publishedDate.toISOString(),
    dateModified: updatedDate.toISOString(),
    numberOfItems: leafItems.length,
    itemListOrder: "Ascending",
    itemListElement: itemListElements
  };
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: canonicalUrl,
    description: descriptionPlain,
    datePublished: publishedDate.toISOString(),
    dateModified: updatedDate.toISOString(),
    image: coverImage,
    mainEntity: webApplicationSchema,
    hasPart: [itemListSchema]
  };

  return (
    <>
      <div className="flex flex-col gap-1 pb-2 md:gap-0 -mt-4 md:-mt-6">
        <header className="sticky top-0 z-30 flex flex-col gap-2 bg-background/95 py-5 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-h-[32px]">
            <h1 className="text-xl font-black leading-tight sm:text-[26px] sm:whitespace-nowrap m-0">
              {page.title}
            </h1>
            <ChecklistProgressHeader title={page.title} slug={page.slug} totalItems={leafItems.length} />
          </div>
        </header>
        <div
          className="-mx-[calc((100vw-100%)/2)] overflow-x-auto px-[calc((100vw-100%)/2)] [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-checklist-scroll
        >
          <div className="w-full pr-6 md:min-w-max">
            <ChecklistBoard
              slug={page.slug}
              items={items}
              descriptionHtml={descriptionHtml}
              className="w-auto min-w-max"
            />
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        />
      </div>

      <ChecklistFooterLinks />
    </>
  );
}
