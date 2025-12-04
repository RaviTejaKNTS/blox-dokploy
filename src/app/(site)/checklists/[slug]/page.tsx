import "@/styles/article-content.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { ChecklistProgressHeader } from "@/components/ChecklistProgressHeader";
import { getChecklistPageBySlug } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // 1 hour

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getChecklistPageBySlug(params.slug);
  if (!data) return {};

  const { page } = data;
  const titleBase = page.seo_title ?? page.title;
  const description = SITE_DESCRIPTION;

  return {
    title: `${titleBase} | ${SITE_NAME}`,
    description,
    alternates: {
      canonical: `${SITE_URL}/checklists/${page.slug}`
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
  const descriptionPlain = SITE_DESCRIPTION;
  const descriptionHtml = page.description_md ? await renderMarkdown(page.description_md) : null;
  const itemListElements = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Thing",
      name: item.title,
      ...(item.description ? { description: item.description } : {}),
      identifier: item.section_code
    }
  }));
  const checklistSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${page.title} Checklist`,
    description: descriptionPlain,
    url: canonicalUrl,
    numberOfItems: items.length,
    itemListOrder: "Ascending",
    itemListElement: itemListElements
  };

  return (
    <div className="flex flex-col gap-3 pb-6 md:gap-2">
      <ChecklistProgressHeader title={page.title} slug={page.slug} totalItems={items.length} />
      <div
        className="-mx-[calc((100vw-100%)/2)] overflow-x-auto px-[calc((100vw-100%)/2)]"
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(checklistSchema) }}
      />
    </div>
  );
}
