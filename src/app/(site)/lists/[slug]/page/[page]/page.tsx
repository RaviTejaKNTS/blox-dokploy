import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildListData, buildMetadata, ListPageView, PAGE_SIZE } from "../../page-data";
import { renderMarkdown } from "@/lib/markdown";

type PageProps = {
  params: Promise<{ slug: string; page: string }>;
};

export const revalidate = 86400; // daily

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
