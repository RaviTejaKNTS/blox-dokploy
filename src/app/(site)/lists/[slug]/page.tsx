import type { Metadata } from "next";
import type { getGameListMetadata } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { buildListData, buildMetadata, ListPageView } from "./page-data";
import "@/styles/article-content.css";

export const revalidate = 86400; // daily

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GameListPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await buildListData(slug, 1);
  const [heroHtml, introHtml, outroHtml] = await Promise.all([
    data.list.hero_md ? renderMarkdown(data.list.hero_md) : Promise.resolve(""),
    data.list.intro_md ? renderMarkdown(data.list.intro_md) : Promise.resolve(""),
    data.list.outro_md ? renderMarkdown(data.list.outro_md) : Promise.resolve("")
  ]);

  return (
    <ListPageView
      slug={slug}
      list={data.list as NonNullable<Awaited<ReturnType<typeof getGameListMetadata>>>}
      entries={data.entries}
      jumpEntries={data.jumpEntries}
      allLists={(data.list as any).other_lists ?? []}
      currentPage={1}
      totalEntries={data.totalEntries}
      heroHtml={heroHtml}
      introHtml={introHtml}
      outroHtml={outroHtml}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata(slug, 1);
}
