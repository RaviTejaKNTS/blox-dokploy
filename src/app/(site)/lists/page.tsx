import { formatDistanceToNow } from "date-fns";
import { listPublishedGameLists } from "@/lib/db";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { ListCard } from "@/components/ListCard";

type ListEntryPreview = {
  game?: { cover_image?: string | null } | null;
  universe?: { icon_url?: string | null } | null;
};

export const revalidate = 86400; // daily

export const metadata = {
  title: `Roblox Game Lists | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/lists`
  }
};

export default async function ListsPage() {
  const lists = await listPublishedGameLists();
  const cards = await Promise.all(
    (lists ?? []).map(async (list) => {
      const entries = Array.isArray(list.entries) ? (list.entries as ListEntryPreview[]) : [];
      const topEntry = entries[0] ?? null;
      const topImage = topEntry?.game?.cover_image ?? topEntry?.universe?.icon_url ?? null;
      const displayName = list.display_name || list.title;
      return {
        id: list.id,
        title: list.title,
        displayName,
        slug: list.slug,
        coverImage: list.cover_image || topImage || `${SITE_URL}/og-image.png`,
        updatedAt: list.updated_at ?? list.refreshed_at ?? list.created_at,
        itemsCount: typeof list.limit_count === "number" ? list.limit_count : null
      };
    })
  );

  const latest = cards.reduce<Date | null>((latestDate, card) => {
    if (!card.updatedAt) return latestDate;
    const candidate = new Date(card.updatedAt);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-8">
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
            {cards.length} published lists
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <ListCard
              key={card.id}
              displayName={card.displayName}
              title={card.title}
              slug={card.slug}
              coverImage={card.coverImage}
              updatedAt={card.updatedAt}
              itemsCount={card.itemsCount}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No published lists yet. Check back soon.
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Game Lists",
            description: SITE_DESCRIPTION,
            url: `${SITE_URL}/lists`
          })
        }}
      />
    </div>
  );
}
