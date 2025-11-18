import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameListItem } from "@/components/GameListItem";
import { SocialShare } from "@/components/SocialShare";
import {
  getGameListBySlug,
  getGameListMetadata,
  listPublishedGameLists,
  listRanksForUniverses,
  type GameListUniverseEntry,
  type UniverseListBadge
} from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { formatUpdatedLabel } from "@/lib/updated-label";
import "@/styles/article-content.css";

export const revalidate = 30;

type PageProps = {
  params: { slug: string };
};

type GameListEntryWithBadges = GameListUniverseEntry & { badges?: UniverseListBadge[] };

export const PAGE_SIZE = 10;

function formatMetric(value?: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function listEntryUrl(entry: GameListUniverseEntry): string {
  if (entry.game?.slug) {
    return `${SITE_URL}/${entry.game.slug}`;
  }
  const placeId = entry.universe.root_place_id ?? entry.universe.universe_id;
  return `https://www.roblox.com/games/${placeId}`;
}

function listEntryName(entry: GameListUniverseEntry): string {
  return entry.game?.name ?? entry.universe.display_name ?? entry.universe.name;
}

export async function buildListData(slug: string) {
  const [data, allLists] = await Promise.all([getGameListBySlug(slug), listPublishedGameLists()]);
  if (!data) {
    notFound();
  }

  const { list, entries } = data;
  const universeIds = entries.map((entry) => entry.universe_id);
  const rankBadgesMap = await listRanksForUniverses(universeIds, list.id);
  const entriesWithBadges: GameListEntryWithBadges[] = entries.map((entry) => ({
    ...entry,
    badges: (rankBadgesMap.get(entry.universe_id) ?? []).slice(0, 3)
  }));

  return { list, allLists, entries: entriesWithBadges };
}

export async function buildMetadata(slug: string, page: number): Promise<Metadata> {
  const list = await getGameListMetadata(slug);
  if (!list) return {};

  const description = list.meta_description
    ? list.meta_description
    : list.intro_md
    ? markdownToPlainText(list.intro_md).slice(0, 160)
    : SITE_DESCRIPTION;

  const titleBase = list.meta_title ?? list.title;
  const title = page > 1 ? `${titleBase} - Page ${page} | ${SITE_NAME}` : `${titleBase} | ${SITE_NAME}`;
  const canonicalPath = page > 1 ? `/lists/${slug}/page/${page}` : `/lists/${slug}`;
  const canonical = `${SITE_URL}${canonicalPath}`;

  return {
    title,
    description,
    alternates: {
      canonical
    }
  };
}

function buildPagination(totalPages: number, currentPage: number): Array<number | "ellipsis"> {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const filtered = Array.from(pages).filter((p) => p >= 1 && p <= totalPages);
  const sorted = filtered.sort((a, b) => a - b);

  const result: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    const prev = sorted[i - 1];
    if (prev !== undefined && value - prev > 1) {
      result.push("ellipsis");
    }
    result.push(value);
  }
  return result;
}

function Pagination({
  slug,
  currentPage,
  totalPages
}: {
  slug: string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const sequence = buildPagination(totalPages, currentPage);
  const pageHref = (page: number) => (page === 1 ? `/lists/${slug}` : `/lists/${slug}/page/${page}`);

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
      <a
        href={pageHref(Math.max(1, currentPage - 1))}
        rel="prev"
        className="rounded-lg border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        aria-disabled={currentPage === 1}
      >
        Prev
      </a>
      {sequence.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted">
            …
          </span>
        ) : (
          <a
            key={item}
            href={pageHref(item)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              item === currentPage
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border/60 text-foreground hover:border-accent hover:text-accent"
            }`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </a>
        )
      )}
      <a
        href={pageHref(Math.min(totalPages, currentPage + 1))}
        rel="next"
        className="rounded-lg border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        aria-disabled={currentPage === totalPages}
      >
        Next
      </a>
    </nav>
  );
}

function SidebarNav({
  slug,
  entries
}: {
  slug: string;
  entries: GameListEntryWithBadges[];
}) {
  if (!entries.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        <span>Jump to game</span>
        <span>Top {entries.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {entries.map((entry, index) => {
          const pageForEntry = Math.floor(index / PAGE_SIZE) + 1;
          const base = pageForEntry === 1 ? `/lists/${slug}` : `/lists/${slug}/page/${pageForEntry}`;
          const href = `${base}#list-entry-${entry.universe.universe_id}`;
          const extra = (entry?.extra ?? null) as { metric?: string } | null;
          const metricLabel = extra?.metric;
          const metricValue = formatMetric(entry.metric_value);
          const metricText = metricValue ? `${metricValue}${metricLabel ? ` ${metricLabel}` : ""}` : null;
          return (
            <a
              key={entry.universe.universe_id}
              href={href}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-surface/50 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:bg-accent/5 hover:text-accent"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-accent">#{index + 1}</span>
                <span className="truncate">{listEntryName(entry)}</span>
              </span>
              {metricText ? <span className="ml-2 text-xs font-semibold text-muted whitespace-nowrap">{metricText}</span> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function ListPageView({
  slug,
  list,
  entries,
  allLists,
  currentPage,
  heroHtml,
  introHtml,
  outroHtml
}: {
  slug: string;
  list: NonNullable<Awaited<ReturnType<typeof getGameListMetadata>>>;
  entries: GameListEntryWithBadges[];
  allLists: Awaited<ReturnType<typeof listPublishedGameLists>>;
  currentPage: number;
  heroHtml: string;
  introHtml: string;
  outroHtml: string;
}) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  const showIntroOutro = page === 1;
  const pageTitle = page === 1 ? list.title : `${list.title} - Page ${page}`;
  const canonicalPath = page === 1 ? `/lists/${slug}` : `/lists/${slug}/page/${page}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const otherLists = allLists.filter((item) => item.slug !== slug).slice(0, 6);

  const listDescription =
    list.meta_description ??
    (list.intro_md ? markdownToPlainText(list.intro_md).slice(0, 160) : SITE_DESCRIPTION);

  const listSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: pageTitle,
    description: listDescription,
    url: canonicalUrl,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoGame",
        name: listEntryName(entry),
        url: listEntryUrl(entry),
        image: entry.universe.icon_url ?? undefined
      }
    }))
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description: listDescription,
      image: list.cover_image ?? `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: new Date(list.created_at).toISOString(),
      updatedAt: new Date(list.updated_at ?? list.refreshed_at ?? list.created_at).toISOString()
    })
  );

  const updatedLabel = showIntroOutro ? formatUpdatedLabel(list.refreshed_at ?? list.updated_at) : null;

  return (
    <>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 lg:min-h-0">
        <div className="space-y-10 min-w-0 flex-1">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-muted">Roblox Game Lists</p>
                <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">{pageTitle}</h1>
              </div>
              {updatedLabel ? <p className="text-sm text-muted">{updatedLabel}</p> : null}
            </div>
            {/* Mobile jump list placed above the entries */}
            <div className="lg:hidden">
              <details className="rounded-xl border border-border/60 bg-surface/70 px-4 py-3">
                <summary className="flex items-center justify-between text-sm font-semibold text-foreground cursor-pointer">
                  <span>Jump to game</span>
                  <span className="text-xs text-muted">Top {entries.length}</span>
                </summary>
                <div className="mt-3 flex flex-col gap-2">
                  {entries.map((entry, index) => {
                    const pageForEntry = Math.floor(index / PAGE_SIZE) + 1;
                    const base = pageForEntry === 1 ? `/lists/${slug}` : `/lists/${slug}/page/${pageForEntry}`;
                    const href = `${base}#list-entry-${entry.universe.universe_id}`;
                    const extra = (entry?.extra ?? null) as { metric?: string } | null;
                    const metricLabel = extra?.metric;
                    const metricValue = formatMetric(entry.metric_value);
                    const metricText = metricValue ? `${metricValue}${metricLabel ? ` ${metricLabel}` : ""}` : null;
                    return (
                      <a
                        key={entry.universe.universe_id}
                        href={href}
                        className="flex items-center justify-between rounded-xl border border-border/40 bg-surface/50 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:bg-accent/5 hover:text-accent"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-accent">#{index + 1}</span>
                          <span className="truncate">{listEntryName(entry)}</span>
                        </span>
                        {metricText ? (
                          <span className="ml-2 text-xs font-semibold text-muted whitespace-nowrap">{metricText}</span>
                        ) : null}
                      </a>
                    );
                  })}
                </div>
              </details>
            </div>
            {showIntroOutro ? (
              <section className="space-y-6">
                {heroHtml ? (
                  <div className="prose dark:prose-invert max-w-none game-copy" dangerouslySetInnerHTML={{ __html: heroHtml }} />
                ) : null}
                {introHtml ? (
                  <div className="prose dark:prose-invert max-w-none game-copy" dangerouslySetInnerHTML={{ __html: introHtml }} />
                ) : null}
              </section>
            ) : null}
          </div>

          {pageEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
              No Roblox experiences matched this list yet. Check back soon.
            </div>
          ) : (
            <div className="space-y-6">
              {pageEntries.map((entry, index) => {
                const extra = (entry?.extra ?? null) as { metric?: string } | null;
                const rank = start + index + 1;
                const metricLabel = extra?.metric;
                return (
                  <div
                    id={`list-entry-${entry.universe.universe_id}`}
                    key={entry.universe.universe_id}
                    className="scroll-mt-32"
                  >
                    <GameListItem entry={entry} rank={rank} metricLabel={metricLabel} />
                  </div>
                );
              })}
            </div>
          )}

          {showIntroOutro && outroHtml ? (
            <section className="space-y-4 text-muted">
              <div
                className="prose dark:prose-invert max-w-none game-copy text-muted"
                dangerouslySetInnerHTML={{ __html: outroHtml }}
              />
            </section>
          ) : null}

          <Pagination slug={slug} currentPage={page} totalPages={totalPages} />
        </div>

        <div className="mt-0 space-y-6 lg:w-[320px]">
          <div className="hidden lg:block">
            <SidebarNav slug={slug} entries={entries} />
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface p-5">
            <h2 className="text-lg font-semibold text-foreground">Lists library</h2>
            <p className="mb-3 text-sm text-muted">More curated Roblox game picks.</p>
            <div className="flex flex-col gap-3">
              {otherLists.map((other) => (
                <a
                  key={other.id}
                  href={`/lists/${other.slug}`}
                  className="rounded-lg border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                >
                  {other.title}
                </a>
              ))}
            </div>
          </div>
          <SocialShare url={canonicalUrl} title={pageTitle} />
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
    </>
  );
}

export default async function GameListPage({ params }: PageProps) {
  const data = await buildListData(params.slug);
  const [heroHtml, introHtml, outroHtml] = await Promise.all([
    data.list.hero_md ? renderMarkdown(data.list.hero_md) : Promise.resolve(""),
    data.list.intro_md ? renderMarkdown(data.list.intro_md) : Promise.resolve(""),
    data.list.outro_md ? renderMarkdown(data.list.outro_md) : Promise.resolve("")
  ]);

  return (
    <ListPageView
      slug={params.slug}
      list={data.list as NonNullable<Awaited<ReturnType<typeof getGameListMetadata>>>}
      entries={data.entries}
      allLists={data.allLists}
      currentPage={1}
      heroHtml={heroHtml}
      introHtml={introHtml}
      outroHtml={outroHtml}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMetadata(params.slug, 1);
}
