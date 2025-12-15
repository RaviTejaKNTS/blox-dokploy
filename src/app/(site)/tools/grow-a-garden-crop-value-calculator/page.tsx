import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContent } from "@/lib/tools";
import { loadCropDataset } from "@/lib/grow-a-garden/crops";
import { GrowGardenCropValueCalculatorClient } from "./GrowGardenCropValueCalculatorClient";
import { GAG_MUTATIONS, GAG_VARIANTS } from "@/lib/grow-a-garden/mutations";

export const revalidate = 43200; // 12 hours

const TOOL_CODE = "grow-a-garden-crop-value-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/${TOOL_CODE}`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

async function buildContent() {
  const tool = await getToolContent(TOOL_CODE);
  const introHtml = tool?.intro_md ? await renderMarkdown(tool.intro_md) : "";
  const howHtml = tool?.how_it_works_md ? await renderMarkdown(tool.how_it_works_md) : "";
  return { tool, introHtml, howHtml };
}

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContent(TOOL_CODE);
  const title = tool?.seo_title || tool?.title || "Grow a Garden Crop Value Calculator";
  const description =
    tool?.meta_description ||
    "Calculate Grow a Garden crop value using average value, weight, variants, and mutations with live breakdowns.";
  const image = tool?.thumb_url || FALLBACK_IMAGE;
  const publishedTime = tool?.published_at ?? tool?.created_at;
  const modifiedTime = tool?.updated_at ?? tool?.published_at ?? tool?.created_at;

  return {
    title,
    description,
    alternates: { canonical: CANONICAL },
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

export default async function GrowGardenCropValueCalculatorPage() {
  const [{ tool, introHtml, howHtml }, cropDataset] = await Promise.all([buildContent(), loadCropDataset()]);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: tool?.title ?? "Grow a Garden Crop Value Calculator",
        description:
          tool?.meta_description ??
          "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown.",
        url: CANONICAL,
        datePublished: tool?.published_at ? new Date(tool.published_at).toISOString() : undefined,
        dateModified: tool?.updated_at ? new Date(tool.updated_at).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "Grow a Garden Crop Value Calculator" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? "Grow a Garden Crop Value Calculator",
          description:
            tool?.meta_description ??
            "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown.",
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
            <span className="font-semibold text-foreground/80">
              {tool?.title ?? "Grow a Garden Crop Value Calculator"}
            </span>
          </li>
        </ol>
      </nav>

      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {tool?.title ?? "Grow a Garden Crop Value Calculator"}
          </h1>
          <p className="max-w-3xl text-base text-muted md:text-lg">
            {tool?.meta_description ??
              "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown."}
          </p>
        </header>

        <GrowGardenCropValueCalculatorClient
          crops={cropDataset.crops}
          variants={GAG_VARIANTS}
          mutations={GAG_MUTATIONS}
          introHtml={introHtml}
          howHtml={howHtml}
        />
      </div>
    </>
  );
}
