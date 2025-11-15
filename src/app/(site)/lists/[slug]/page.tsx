import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameListItem } from "@/components/GameListItem";
import { SocialShare } from "@/components/SocialShare";
import { SmallGameListItem } from "@/components/SmallGameListItem";
import { getGameListBySlug, getGameListMetadata, listPublishedGameLists, type GameListUniverseEntry } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { formatUpdatedLabel } from "@/lib/updated-label";

export const revalidate = 30;

type PageProps = {
  params: { slug: string };
};

export async function generateStaticParams() {
  const lists = await listPublishedGameLists();
  return lists.map((list) => ({ slug: list.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const list = await getGameListMetadata(params.slug);
  if (!list) {
    return {};
  }

  const description = list.meta_description
    ? list.meta_description
    : list.intro_md
      ? markdownToPlainText(list.intro_md).slice(0, 160)
      : SITE_DESCRIPTION;

  return {
    title: list.meta_title ?? `${list.title} | ${SITE_NAME}`,
    description
  };
}

function ListIntro({ heroHtml, introHtml }: { heroHtml: string; introHtml: string }) {
  if (!heroHtml && !introHtml) return null;
  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
      {heroHtml ? (
        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: heroHtml }} />
      ) : null}
      {introHtml ? (
        <div className="prose prose-invert max-w-none text-base text-muted" dangerouslySetInnerHTML={{ __html: introHtml }} />
      ) : null}
    </div>
  );
}

function ListOutro({ outroHtml }: { outroHtml: string }) {
  if (!outroHtml) return null;
  return (
    <div
      className="prose prose-invert max-w-none rounded-2xl border border-dashed border-border/60 bg-surface/60 p-6 text-muted"
      dangerouslySetInnerHTML={{ __html: outroHtml }}
    />
  );
}

function formatListUpdated(listUpdatedAt: string | null | undefined) {
  const label = formatUpdatedLabel(listUpdatedAt);
  return label ? `Last refreshed ${label}` : null;
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

export default async function GameListPage({ params }: PageProps) {
  const [data, allLists] = await Promise.all([getGameListBySlug(params.slug), listPublishedGameLists()]);
  if (!data) {
    notFound();
  }

  const { list, entries } = data;
  const canonicalUrl = `${SITE_URL}/lists/${list.slug}`;
  const otherLists = allLists.filter((item) => item.slug !== list.slug).slice(0, 6);
  const [heroHtml, introHtml, outroHtml] = await Promise.all([
    list.hero_md ? renderMarkdown(list.hero_md) : Promise.resolve(""),
    list.intro_md ? renderMarkdown(list.intro_md) : Promise.resolve(""),
    list.outro_md ? renderMarkdown(list.outro_md) : Promise.resolve("")
  ]);
  const updatedLabel = formatListUpdated(list.refreshed_at ?? list.updated_at);
  const listDescription =
    list.meta_description ??
    (list.intro_md ? markdownToPlainText(list.intro_md).slice(0, 160) : SITE_DESCRIPTION);
  const listSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.title,
    description: listDescription,
    url: canonicalUrl,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: listEntryUrl(entry),
      name: listEntryName(entry),
      image: entry.universe.icon_url ?? undefined
    }))
  });

  return (
    <>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-10">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted">Roblox Game Lists</p>
              <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">{list.title}</h1>
            </div>
            {updatedLabel ? <p className="text-sm text-muted">{updatedLabel}</p> : null}
          </div>
          <ListIntro heroHtml={heroHtml} introHtml={introHtml} />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
            No Roblox experiences matched this list yet. Check back soon.
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, index) => {
              const extra = (entry?.extra ?? null) as { metric?: string } | null;
              const rank = index + 1;
              const metricLabel = extra?.metric;
              if (rank <= 10) {
                return (
                  <GameListItem
                    key={entry.universe.universe_id}
                    entry={entry}
                    rank={rank}
                    metricLabel={metricLabel}
                  />
                );
              }
              return (
                <SmallGameListItem
                  key={entry.universe.universe_id}
                  entry={entry}
                  rank={rank}
                  metricLabel={metricLabel}
                />
              );
            })}
          </div>
        )}

        <ListOutro outroHtml={outroHtml} />
      </div>

      <aside className="space-y-6">
        <div className="p-6">
          <SocialShare url={canonicalUrl} title={list.title} heading="Share this list" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-6">
          <h3 className="text-lg font-semibold text-foreground">Explore other lists</h3>
          <p className="mt-1 text-sm text-muted">Discover more curated Roblox experiences.</p>
          {otherLists.length ? (
            <div className="mt-4 space-y-3">
              {otherLists.map((item) => (
                <Link
                  key={item.id}
                  href={`/lists/${item.slug}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                >
                  <span className="line-clamp-2 text-left">{item.title}</span>
                  <span className="text-xs text-muted">View</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">More lists coming soon.</p>
          )}
        </div>
      </aside>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
    </>
  );
}
