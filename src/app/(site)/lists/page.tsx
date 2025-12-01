import { Suspense } from "react";
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

async function ListsContent() {
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

  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No published lists yet. Check back soon.
      </div>
    );
  }

  return (
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
  );
}

export default function ListsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Roblox Game Lists</p>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Roblox Game Lists</h1>
        <p className="text-sm text-muted max-w-3xl">
          Curated rankings and collections of Roblox experiences — updated regularly.
        </p>
      </header>
      <Suspense fallback={<div className="text-muted">Loading lists…</div>}>
        <ListsContent />
      </Suspense>

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
