import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { QuizCard } from "@/components/QuizCard";
import { listPublishedQuizzes, type QuizListEntry } from "@/lib/quizzes";
import { QUIZZES_DESCRIPTION, SITE_URL } from "@/lib/seo";

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

function mapRowToCard(row: QuizListEntry) {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumb = pickThumbnail(row.universe?.thumbnail_urls);
  const coverImage = row.universe?.icon_url || thumb || `${SITE_URL}/og-image.png`;
  const updatedAt = row.content_updated_at || row.updated_at || row.published_at || row.created_at || null;
  const summary = summarize(row.seo_description ?? row.description_md ?? null, QUIZZES_DESCRIPTION);

  return {
    code: row.code,
    title: row.title,
    summary,
    universeName,
    coverImage,
    updatedAt
  };
}

async function loadQuizzes() {
  const quizzes = await listPublishedQuizzes();
  const cards = (quizzes ?? []).map(mapRowToCard);
  return { cards, total: quizzes.length };
}

function QuizzesPageView({ cards, total }: { cards: ReturnType<typeof mapRowToCard>[]; total: number }) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Quizzes</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox quizzes to test in-game knowledge
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Quick, replayable quizzes built from in-game mechanics, NPCs, and regions. Pick a game and take a 15-question run.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total} quizzes published
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <div
              key={card.code}
              className="contents"
              data-analytics-event="select_item"
              data-analytics-item-list-name="quizzes_index"
              data-analytics-item-id={card.code}
              data-analytics-item-name={card.title}
              data-analytics-position={index + 1}
              data-analytics-content-type="quiz"
            >
              <QuizCard {...card} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No quizzes have been published yet. Check back soon.
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-surface/60 p-4 text-xs text-muted">
        Want a quiz for another game? <Link href="/contact" className="text-accent underline-offset-4 hover:underline">Tell us</Link> which
        experience you want next.
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Quizzes",
            description: QUIZZES_DESCRIPTION,
            url: `${SITE_URL}/quizzes`
          })
        }}
      />
    </div>
  );
}

export async function loadQuizzesPageData() {
  return loadQuizzes();
}

export function renderQuizzesPage(props: Parameters<typeof QuizzesPageView>[0]) {
  return <QuizzesPageView {...props} />;
}
