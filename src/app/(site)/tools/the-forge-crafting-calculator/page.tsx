import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContent, type ToolContent, type ToolFaqEntry } from "@/lib/tools";
import { ForgeCalculatorClient } from "./ForgeCalculatorClient";

export const revalidate = 3600;

const TOOL_CODE = "the-forge-crafting-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/the-forge-crafting-calculator`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

async function buildToolContent(): Promise<{
  tool: ToolContent | null;
  introHtml: string;
  howHtml: string;
  faqHtml: Array<{ q: string; a: string }>;
}> {
  const tool = (await getToolContent(TOOL_CODE)) ?? null;
  const introHtml = tool?.intro_md ? await renderMarkdown(tool.intro_md) : "";
  const howHtml = tool?.how_it_works_md ? await renderMarkdown(tool.how_it_works_md) : "";
  const faqEntries: ToolFaqEntry[] = Array.isArray(tool?.faq_json) ? tool.faq_json : [];
  const faqHtml = await Promise.all(
    faqEntries.map(async (entry) => ({
      q: entry.q,
      a: await renderMarkdown(entry.a ?? "")
    }))
  );
  return { tool, introHtml, howHtml, faqHtml };
}

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContent(TOOL_CODE);
  if (!tool) {
    return {
      title: "The Forge Crafting Calculator",
      description: "Plan your ores for The Forge and see weapon or armor probabilities, multipliers, and trait activations.",
      alternates: { canonical: CANONICAL }
    };
  }

  const title = tool.seo_title ?? tool.title ?? undefined;
  const description = tool.meta_description ?? undefined;
  const image = tool.thumb_url || FALLBACK_IMAGE;
  const publishedTime = tool.published_at ?? tool.created_at;
  const modifiedTime = tool.updated_at ?? tool.published_at ?? tool.created_at;

  return {
    title,
    description,
    alternates: {
      canonical: CANONICAL
    },
    openGraph: {
      type: "article",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image],
      publishedTime: publishedTime ? new Date(publishedTime).toISOString() : undefined,
      modifiedTime: modifiedTime ? new Date(modifiedTime).toISOString() : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ForgeCalculatorPage() {
  const { tool, introHtml, howHtml, faqHtml } = await buildToolContent();
  const publishedTime = tool?.published_at ?? tool?.created_at ?? null;
  const modifiedTime = tool?.updated_at ?? tool?.published_at ?? tool?.created_at ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: tool?.title ?? "The Forge Crafting Calculator",
        description: tool?.meta_description ?? "Plan Forge crafts with ore multipliers, class odds, and traits.",
        url: CANONICAL,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "The Forge Crafting Calculator" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? "The Forge Crafting Calculator",
          description: tool?.meta_description ?? "Forge calculator with ore multipliers, class odds, and trait activation.",
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs uppercase tracking-[0.25em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="flex items-center gap-2">
            <a href="/" className="font-semibold text-muted transition hover:text-accent">
              Home
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <a href="/tools" className="font-semibold text-muted transition hover:text-accent">
              Tools
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-foreground/80">{tool?.title ?? "The Forge Crafting Calculator"}</span>
          </li>
        </ol>
      </nav>

      <ForgeCalculatorClient
        title={tool?.title ?? null}
        introHtml={introHtml || null}
        howHtml={howHtml || null}
        faqHtml={faqHtml}
      />
    </>
  );
}
