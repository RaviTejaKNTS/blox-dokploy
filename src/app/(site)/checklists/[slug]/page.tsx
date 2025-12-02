import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { ChecklistProgressHeader } from "@/components/ChecklistProgressHeader";
import { getChecklistPageBySlug } from "@/lib/db";
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
  const description = page.seo_description ?? SITE_DESCRIPTION;

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

  return (
    <div className="flex flex-col gap-3 pb-6 md:gap-2">
      <ChecklistProgressHeader title={page.title} slug={page.slug} totalItems={items.length} />
      <div className="-mx-[calc((100vw-100%)/2)] overflow-x-auto px-[calc((100vw-100%)/2)]">
        <div className="min-w-max pr-6">
          <ChecklistBoard slug={page.slug} items={items} className="w-auto min-w-max" />
        </div>
      </div>
    </div>
  );
}
