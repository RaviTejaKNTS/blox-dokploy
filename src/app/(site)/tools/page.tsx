import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { listPublishedToolsPage, type ToolListEntry } from "@/lib/tools";
import { TOOLS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { PagePagination } from "@/components/PagePagination";

export const revalidate = 21600; // refresh a few times per day
export const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: `Roblox Tools & Calculators | ${SITE_NAME}`,
  description: TOOLS_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/tools`
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/tools`,
    title: `Roblox Tools & Calculators | ${SITE_NAME}`,
    description: TOOLS_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Tools & Calculators | ${SITE_NAME}`,
    description: TOOLS_DESCRIPTION
  }
};

type PageData = {
  tools: ToolListEntry[];
  total: number;
  totalPages: number;
};

async function loadPage(pageNumber: number): Promise<PageData> {
  const { tools, total } = await listPublishedToolsPage(pageNumber, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { tools, total, totalPages };
}

function ToolsPageView({
  tools,
  total,
  totalPages,
  currentPage,
  showHero
}: {
  tools: ToolListEntry[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
}) {
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
      {showHero ? (
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
              {total} tools published
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Roblox Utilities</p>
          <h1 className="text-3xl font-semibold text-foreground">Roblox utilities</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">Updated {refreshedLabel} · Page {currentPage} of {totalPages}</p>
          ) : null}
        </header>
      )}

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

      <PagePagination basePath="/tools" currentPage={currentPage} totalPages={totalPages} />

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Roblox Tools & Calculators",
              description: TOOLS_DESCRIPTION,
              url: `${SITE_URL}/tools`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export default async function ToolsPage() {
  const { tools, total, totalPages } = await loadPage(1);
  if (!tools) {
    notFound();
  }

  return (
    <ToolsPageView
      tools={tools}
      total={total}
      totalPages={totalPages}
      currentPage={1}
      showHero
    />
  );
}

export async function loadToolsPageData(page: number) {
  return loadPage(page);
}

export function renderToolsPage(props: Parameters<typeof ToolsPageView>[0]) {
  return <ToolsPageView {...props} />;
}
