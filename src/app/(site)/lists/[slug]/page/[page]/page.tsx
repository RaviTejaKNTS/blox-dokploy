import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildListData, buildMetadata, ListPageView, PAGE_SIZE } from "../../page-data";
import { renderMarkdown } from "@/lib/markdown";
import { listPublishedGameListsPage } from "@/lib/db";
import { buildPageParams } from "@/lib/static-params";

type PageProps = {
  params: Promise<{ slug: string; page: string }>;
};

export const revalidate = 86400; // daily
const MAX_STATIC_LIST_SLUGS = 80;
const MAX_STATIC_PAGES_PER_LIST = 2;
const STATIC_PAGE_START = 2;

export async function generateStaticParams() {
  const { lists } = await listPublishedGameListsPage(1, MAX_STATIC_LIST_SLUGS);
  const slugs = lists
    .map((list) => list.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));
  const paramsList: Array<{ slug: string; page: string }> = [];

  for (const slug of slugs) {
    try {
      const data = await buildListData(slug, 1);
      const totalPages = Math.max(1, Math.ceil(data.totalEntries / PAGE_SIZE));
      const pageParams = buildPageParams(totalPages, STATIC_PAGE_START, MAX_STATIC_PAGES_PER_LIST);
      for (const entry of pageParams) {
        paramsList.push({ slug, page: entry.page });
      }
    } catch {
      // Skip lists that cannot be resolved during prerender enumeration.
    }
  }

  return paramsList;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  return buildMetadata(slug, pageNumber);
}

export default async function GameListPageWithPagination({ params }: PageProps) {
  const { slug, page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const data = await buildListData(slug, pageNumber);
  const totalPages = Math.max(1, Math.ceil(data.totalEntries / PAGE_SIZE));
  if (pageNumber > totalPages) {
    notFound();
  }

  const [heroHtml, introHtml, outroHtml] = await Promise.all([
    data.list.hero_md ? renderMarkdown(data.list.hero_md) : Promise.resolve(""),
    data.list.intro_md ? renderMarkdown(data.list.intro_md) : Promise.resolve(""),
    data.list.outro_md ? renderMarkdown(data.list.outro_md) : Promise.resolve("")
  ]);

  const allLists = (data.list as any).other_lists ?? [];

  return (
    <ListPageView
      slug={slug}
      list={data.list}
      entries={data.entries}
      jumpEntries={data.jumpEntries}
      allLists={allLists}
      currentPage={pageNumber}
      totalEntries={data.totalEntries}
      heroHtml={heroHtml}
      introHtml={introHtml}
      outroHtml={outroHtml}
    />
  );
}
