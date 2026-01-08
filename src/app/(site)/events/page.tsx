import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventsPageCard } from "@/components/EventsPageCard";
import { EVENTS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildEventsCards } from "./page-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Roblox Events | ${SITE_NAME}`,
  description: EVENTS_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/events`
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/events`,
    title: `Roblox Events | ${SITE_NAME}`,
    description: EVENTS_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Events | ${SITE_NAME}`,
    description: EVENTS_DESCRIPTION
  }
};

export default async function EventsIndexPage() {
  const { cards, total, refreshedLabel } = await buildEventsCards();
  if (!cards) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Events</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Event schedules and countdowns for Roblox experiences
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Follow upcoming updates, live events, and recent recaps with start times, countdowns, and related guides.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {total} event hubs
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      {cards.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ id, ...card }, index) => (
            <div
              key={id}
              className="contents"
              data-analytics-event="select_item"
              data-analytics-item-list-name="events_index"
              data-analytics-item-id={card.slug}
              data-analytics-item-name={card.title}
              data-analytics-position={index + 1}
              data-analytics-content-type="event"
            >
              <EventsPageCard {...card} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No event hubs have been published yet. Check back soon.
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Events",
            description: EVENTS_DESCRIPTION,
            url: `${SITE_URL}/events`
          })
        }}
      />
    </div>
  );
}
