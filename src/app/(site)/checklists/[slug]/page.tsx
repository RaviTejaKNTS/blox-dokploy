import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import "@/styles/article-content.css";
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
  const description = page.seo_description || SITE_DESCRIPTION;
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
  const descriptionPlain = page.seo_description || SITE_DESCRIPTION;
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
  const checklistSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${page.title} Checklist`,
    description: descriptionPlain,
    url: canonicalUrl,
    datePublished: publishedDate.toISOString(),
    dateModified: updatedDate.toISOString(),
    numberOfItems: leafItems.length,
    itemListOrder: "Ascending",
    itemListElement: itemListElements
  };

  return (
    <>
      <div className="flex flex-col gap-1 pb-2 md:gap-0 -mt-4 md:-mt-6">
        <ChecklistProgressHeader title={page.title} slug={page.slug} totalItems={leafItems.length} />
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(checklistSchema) }}
        />
      </div>

      <div className="fixed bottom-3 right-3 z-30 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-[11px] text-muted shadow-lg backdrop-blur">
        <span>© 2025 Bloxodes</span>
        <span aria-hidden="true">•</span>
        <Link href="/privacy-policy" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
          Privacy
        </Link>
        <span aria-hidden="true">•</span>
        <Link href="/about" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
          About
        </Link>
        <span aria-hidden="true">•</span>
        <Link href="/contact" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
          Contact
        </Link>
      </div>
    </>
  );
}
