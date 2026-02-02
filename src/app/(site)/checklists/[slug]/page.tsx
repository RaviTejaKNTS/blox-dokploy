import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { ChecklistProgressHeader } from "@/components/ChecklistProgressHeader";
import { ChecklistFooterLinks } from "@/components/ChecklistFooterLinks";
import {
  getChecklistPageBySlug,
  getEventsPageByUniverseId,
  listGamesWithActiveCountsByUniverseId,
  listPublishedArticlesByUniverseId,
  listPublishedChecklistsByUniverseId
} from "@/lib/db";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { CHECKLISTS_DESCRIPTION, EVENTS_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";
import { listPublishedToolsByUniverseId } from "@/lib/tools";
import { GameCard } from "@/components/GameCard";
import { ArticleCard } from "@/components/ArticleCard";
import { ToolCard } from "@/components/ToolCard";
import { ChecklistCard } from "@/components/ChecklistCard";
import { EventsPageCard } from "@/components/EventsPageCard";
import { SocialShare } from "@/components/SocialShare";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { getUniverseEventSummary } from "@/lib/events-summary";

export const revalidate = 3600; // 1 hour

type PageProps = {
  params: Promise<{ slug: string }>;
};

function summarize(text: string | null | undefined, fallback: string) {
  const plain = markdownToPlainText(text ?? "");
  const normalized = plain.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getChecklistPageBySlug(slug);
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
  const { slug } = await params;
  const data = await getChecklistPageBySlug(slug);
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
  const universeId = page.universe_id ?? null;
  const universeLabel = page.universe?.display_name ?? page.universe?.name ?? page.title;
  const relatedCodes = universeId ? await listGamesWithActiveCountsByUniverseId(universeId, 1) : [];
  const relatedArticles = universeId ? await listPublishedArticlesByUniverseId(universeId, 3, 0) : [];
  const relatedTools = universeId ? await listPublishedToolsByUniverseId(universeId, 3) : [];
  const relatedChecklistsRaw = universeId ? await listPublishedChecklistsByUniverseId(universeId, 3) : [];
  const relatedEventsPage = universeId ? await getEventsPageByUniverseId(universeId) : null;
  const eventSummary = universeId ? await getUniverseEventSummary(universeId) : null;
  const relatedChecklists = relatedChecklistsRaw.filter((row) => row.id !== page.id);
  const relatedChecklistCards = relatedChecklists.map((row) => {
    const summary = summarize(row.seo_description ?? row.description_md ?? null, CHECKLISTS_DESCRIPTION);
    const itemsCount =
      typeof row.leaf_item_count === "number"
        ? row.leaf_item_count
        : typeof row.item_count === "number"
          ? row.item_count
          : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary,
      universeName: row.universe?.display_name ?? row.universe?.name ?? null,
      coverImage: row.universe?.icon_url ?? `${SITE_URL}/og-image.png`,
      updatedAt: row.updated_at || row.published_at || row.created_at || null,
      itemsCount
    };
  });
  const eventsSummary = relatedEventsPage?.meta_description?.trim() || EVENTS_DESCRIPTION;
  const eventsUpdatedLabel = relatedEventsPage
    ? formatUpdatedLabel(relatedEventsPage.updated_at || relatedEventsPage.published_at || relatedEventsPage.created_at)
    : null;
  const eventsCard =
    relatedEventsPage && relatedEventsPage.slug
      ? {
          slug: relatedEventsPage.slug,
          title: relatedEventsPage.title,
          summary: eventsSummary,
          universeName:
            relatedEventsPage.universe?.display_name ??
            relatedEventsPage.universe?.name ??
            universeLabel,
          coverImage: null,
          fallbackIcon: relatedEventsPage.universe?.icon_url ?? null,
          eventName: eventSummary?.featured?.name ?? null,
          eventTimeLabel: eventSummary?.featured?.timeLabel ?? null,
          status: eventSummary?.featured?.status ?? "none",
          counts: eventSummary?.counts ?? { upcoming: 0, current: 0, past: 0 },
          updatedLabel: eventsUpdatedLabel
        }
      : null;
  const hasSidebar =
    Boolean(universeId) &&
    (relatedCodes.length > 0 ||
      relatedArticles.length > 0 ||
      relatedTools.length > 0 ||
      relatedChecklistCards.length > 0 ||
      Boolean(eventsCard));
  const boardContainerClass = hasSidebar
    ? "-mx-[calc((100vw-100%)/2)] lg:mx-0 overflow-x-auto px-[calc((100vw-100%)/2)] lg:px-0 [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "-mx-[calc((100vw-100%)/2)] overflow-x-auto px-[calc((100vw-100%)/2)] [scrollbar-color:theme(colors.border)_transparent] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const mainContent = (
    <div className="flex flex-col gap-1 pb-2 md:gap-0 -mt-4 md:-mt-6">
      <header className="sticky top-0 z-30 flex flex-col gap-2 bg-background/95 py-5 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-h-[32px]">
          <h1 className="text-xl font-black leading-tight sm:text-[26px] sm:whitespace-nowrap m-0">
            {page.title}
          </h1>
          <ChecklistProgressHeader title={page.title} slug={page.slug} totalItems={leafItems.length} />
        </div>
      </header>
      <div className={boardContainerClass} data-checklist-scroll>
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
  );

  return (
    <>
      {hasSidebar ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
          <div className="min-w-0">{mainContent}</div>
          <aside className="space-y-4">
            <SocialShare
              url={canonicalUrl}
              title={`${page.title} Checklist`}
              heading="Share this checklist"
              analytics={{ contentType: "checklist", itemId: page.slug }}
            />

            {eventsCard ? (
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Events for {universeLabel}</h3>
                <div className="space-y-3">
                  <div
                    className="block"
                    data-analytics-event="related_content_click"
                    data-analytics-source-type="checklist_sidebar"
                    data-analytics-target-type="event"
                    data-analytics-target-slug={eventsCard.slug}
                  >
                    <EventsPageCard {...eventsCard} />
                  </div>
                </div>
              </section>
            ) : null}

            {relatedCodes.length ? (
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Codes for {universeLabel}</h3>
                <div className="grid gap-3">
                  {relatedCodes.map((game) => (
                    <div
                      key={game.id}
                      className="block"
                      data-analytics-event="related_content_click"
                      data-analytics-source-type="checklist_sidebar"
                      data-analytics-target-type="codes"
                      data-analytics-target-slug={game.slug}
                    >
                      <GameCard game={game} titleAs="p" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {relatedChecklistCards.length ? (
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">More checklists for {universeLabel}</h3>
                <div className="space-y-3">
                  {relatedChecklistCards.map((card) => (
                    <div
                      key={card.id}
                      className="block"
                      data-analytics-event="related_content_click"
                      data-analytics-source-type="checklist_sidebar"
                      data-analytics-target-type="checklist"
                      data-analytics-target-slug={card.slug}
                    >
                      <ChecklistCard {...card} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {relatedArticles.length ? (
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Articles on {universeLabel}</h3>
                <div className="space-y-4">
                  {relatedArticles.map((article) => (
                    <div
                      key={article.id}
                      className="block"
                      data-analytics-event="related_content_click"
                      data-analytics-source-type="checklist_sidebar"
                      data-analytics-target-type="article"
                      data-analytics-target-slug={article.slug}
                    >
                      <ArticleCard article={article} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {relatedTools.length ? (
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Tools for {universeLabel}</h3>
                <div className="space-y-4">
                  {relatedTools.map((tool) => (
                    <div
                      key={tool.id ?? tool.code}
                      className="block"
                      data-analytics-event="related_content_click"
                      data-analytics-source-type="checklist_sidebar"
                      data-analytics-target-type="tool"
                      data-analytics-target-slug={tool.code}
                    >
                      <ToolCard tool={tool} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        mainContent
      )}

      <ChecklistFooterLinks />
    </>
  );
}
