import Link from "next/link";
import { listPublishedChecklists } from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { ChecklistCard } from "@/components/ChecklistCard";

export const revalidate = 21600; // 6 hours

export const metadata = {
  title: `Roblox Checklists | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/checklists`
  }
};

type ChecklistCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
};

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry;
      if (entry && typeof entry === "object" && "url" in entry) {
        const url = (entry as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) return url;
      }
    }
  }
  return null;
}

function summarize(descriptionMd: string | null | undefined, fallback: string): string {
  if (!descriptionMd) return fallback;
  const plain = descriptionMd.replace(/[#>*_`~[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return fallback;
  if (plain.length <= 160) return plain;
  const slice = plain.slice(0, 157);
  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 120 ? slice.slice(0, lastSpace) : slice}…`;
}

export default async function ChecklistsPage() {
  const rows = await listPublishedChecklists();

  const cards: ChecklistCardData[] = rows.map((row) => {
    const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
    const thumb = pickThumbnail(row.universe?.thumbnail_urls);
    const coverImage = row.universe?.icon_url || thumb || `${SITE_URL}/og-image.png`;
    const updatedAt = row.updated_at || row.published_at || row.created_at || null;
    const itemsCount = Array.isArray(row.items) ? row.items[0]?.count ?? null : null;
    const summary = summarize(row.seo_description ?? row.description_md ?? null, SITE_DESCRIPTION);

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary,
      universeName,
      coverImage,
      updatedAt,
      itemsCount
    };
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Roblox Checklists</p>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Roblox Checklists</h1>
        <p className="text-sm text-muted max-w-3xl">
          Guided, actionable runbooks for your favorite Roblox experiences — track your progress as you go.
        </p>
      </header>

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <ChecklistCard key={card.id} {...card} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No public checklists yet. Check back soon.
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-surface/60 p-4 text-xs text-muted">
        Want a checklist added? <Link href="/contact" className="text-accent underline-offset-4 hover:underline">Tell us</Link> which
        game you want a guided rundown for.
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Checklists",
            description: SITE_DESCRIPTION,
            url: `${SITE_URL}/checklists`
          })
        }}
      />
    </div>
  );
}
