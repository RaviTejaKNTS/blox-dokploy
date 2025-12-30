import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadEventsPage, renderEventsPage } from "../../page";

export const revalidate = 3600;

type PageProps = {
  params: { slug: string; page: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};

  const page = await loadEventsPage(params.slug);
  if (!page) return {};

  const canonicalSlug = page.slug ?? params.slug;

  return {
    title: `${page.title} - Page ${pageNumber} | ${SITE_NAME}`,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE_URL}/events/${canonicalSlug}/page/${pageNumber}`
    }
  };
}

export default async function EventsPastPaginatedPage({ params }: PageProps) {
  const pageNumber = Number(params.page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  return renderEventsPage({ slug: params.slug, pastPage: pageNumber });
}
