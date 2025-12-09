import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { ToolCard } from "@/components/ToolCard";
import { listPublishedTools } from "@/lib/tools";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";

export const revalidate = 21600; // refresh a few times per day

export async function generateMetadata(): Promise<Metadata> {
  const tools = await listPublishedTools();
  const updatedAt =
    tools.reduce<string | null>((latest, tool) => {
      const candidate = tool.updated_at ?? tool.published_at ?? tool.created_at;
      if (!candidate) return latest;
      if (!latest || candidate > latest) return candidate;
      return latest;
    }, null) ?? null;

  const updatedIso = updatedAt ? new Date(updatedAt).toISOString() : undefined;

  return {
    title: `Roblox Tools & Calculators | ${SITE_NAME}`,
    description: `${SITE_NAME} utilities, calculators, and planners for Roblox players.`,
    alternates: {
      canonical: `${SITE_URL}/tools`
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/tools`,
      title: `Roblox Tools & Calculators | ${SITE_NAME}`,
      description: `${SITE_NAME} utilities, calculators, and planners for Roblox players.`,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title: `Roblox Tools & Calculators | ${SITE_NAME}`,
      description: `${SITE_NAME} utilities, calculators, and planners for Roblox players.`
    }
  };
}

export default async function ToolsPage() {
  const tools = await listPublishedTools();
  const latest = tools.reduce<Date | null>((latestDate, tool) => {
    const candidate = tool.updated_at ?? tool.published_at ?? tool.created_at;
    if (!candidate) return latestDate;
    const candidateDate = new Date(candidate);
    if (!latestDate || candidateDate > latestDate) return candidateDate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Utilities</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox tools and calculators to plan faster
        </h1>
        <p className="max-w-2xl text-base text-muted md:text-lg">
          Currency converters, planning helpers, and utilities built to stay current with our latest data and guides.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {tools.length} tools published
          </span>
          {refreshedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Last updated {refreshedLabel}
            </span>
          ) : null}
        </div>
      </header>

      {tools.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id ?? tool.code} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No tools have been published yet. Check back soon.
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Roblox Tools & Calculators",
            description: SITE_DESCRIPTION,
            url: `${SITE_URL}/tools`
          })
        }}
      />
    </div>
  );
}
