import { formatDistanceToNow } from "date-fns";
import { listPublishedGameListsPage, type GameList } from "@/lib/db";
import { LISTS_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { ListCard } from "@/components/ListCard";
import { PagePagination } from "@/components/PagePagination";

const PAGE_SIZE = 20;

type Card = {
  id: string;
  title: string;
  displayName: string;
  slug: string;
  coverImage: string | null;
  updatedAt?: string | null;
  itemsCount?: number | null;
};

type PageData = {
  cards: Card[];
  total: number;
  totalPages: number;
};

async function mapListsToCards(lists: GameList[]): Promise<Card[]> {
  return Promise.all(
    lists.map(async (list) => {
      const displayName = (list as any).display_name || list.title;
      const topImage = (list as any).top_entry_image ?? null;
      return {
        id: list.id,
        title: list.title,
        displayName,
        slug: list.slug,
        coverImage: (list as any).cover_image || topImage || `${SITE_URL}/og-image.png`,
        updatedAt: (list as any).updated_at ?? (list as any).refreshed_at ?? list.created_at,
        itemsCount: typeof (list as any).limit_count === "number" ? (list as any).limit_count : null
      };
    })
  );
}

async function loadPage(pageNumber: number): Promise<PageData> {
  const { lists, total } = await listPublishedGameListsPage(pageNumber, PAGE_SIZE);
  const cards = await mapListsToCards(lists ?? []);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { cards, total, totalPages };
}

function ListsPageView({
  cards,
  total,
  totalPages,
  currentPage,
  showHero
}: {
  cards: Card[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
}) {
  const latest = cards.reduce<Date | null>((latestDate, card) => {
    if (!card.updatedAt) return latestDate;
    const candidate = new Date(card.updatedAt);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-8">
      {showHero ? (
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Game Lists</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Roblox game lists powered by live data, updated regularly
          </h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Rankings and collections driven by live Roblox data and refreshed regularly to help you discover what to play next.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
            <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
              {total} published lists
            </span>
            {refreshedLabel ? (
              <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
                Last updated {refreshedLabel}
              </span>
            ) : null}
          </div>
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Roblox Game Lists</p>
          <h1 className="text-3xl font-semibold text-foreground">Game lists</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card, index) => (
            <div
              key={card.id}
              className="contents"
              data-analytics-event="select_item"
              data-analytics-item-list-name="lists_index"
              data-analytics-item-id={card.slug}
              data-analytics-item-name={card.displayName}
              data-analytics-position={index + 1}
              data-analytics-content-type="list"
            >
              <ListCard
                displayName={card.displayName}
                title={card.title}
                slug={card.slug}
                coverImage={card.coverImage}
                updatedAt={card.updatedAt}
                itemsCount={card.itemsCount}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No published lists yet. Check back soon.
        </div>
      )}

      <PagePagination basePath="/lists" currentPage={currentPage} totalPages={totalPages} />

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Roblox Game Lists",
              description: LISTS_DESCRIPTION,
              url: `${SITE_URL}/lists`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export async function loadListsPageData(page: number) {
  return loadPage(page);
}

export function renderListsPage(props: Parameters<typeof ListsPageView>[0]) {
  return <ListsPageView {...props} />;
}
