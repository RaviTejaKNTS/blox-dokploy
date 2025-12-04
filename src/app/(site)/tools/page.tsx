import type { Metadata } from "next";
import { ToolCard } from "@/components/ToolCard";
import { listPublishedTools } from "@/lib/tools";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";

export const revalidate = 21600; // refresh a few times per day

export const metadata: Metadata = {
  title: `Roblox Tools & Calculators | ${SITE_NAME}`,
  description: `${SITE_NAME} utilities, calculators, and planners for Roblox players.`,
  alternates: {
    canonical: `${SITE_URL}/tools`
  }
};

export default async function ToolsPage() {
  const tools = await listPublishedTools();

  return (
    <div className="space-y-10">
      <header className="space-y-3 rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Roblox Utilities</p>
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl">Tools & Calculators</h1>
        <p className="max-w-3xl text-sm text-muted sm:text-base">
          A growing toolkit of Roblox helpers from the Bloxodes team — from currency converters to planning utilities. Each tool is built
          to stay current with our latest data and guides.
        </p>
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
