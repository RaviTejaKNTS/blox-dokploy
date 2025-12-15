import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContent } from "@/lib/tools";
import { loadCropDataset } from "@/lib/grow-a-garden/crops";
import { GrowGardenCropValueCalculatorClient } from "./GrowGardenCropValueCalculatorClient";
import { GAG_META, GAG_MUTATIONS, GAG_VARIANTS } from "@/lib/grow-a-garden/mutations";

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

  const lastUpdated =
    cropDataset.dataLastUpdatedOn || GAG_META.dataLastUpdatedOn || tool?.content_updated_at || tool?.updated_at || null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:px-6 md:py-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox • Grow a Garden</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {tool?.title ?? "Grow a Garden Crop Value Calculator"}
        </h1>
        <p className="max-w-3xl text-base text-muted md:text-lg">
          {tool?.meta_description ??
            "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown."}
        </p>
        {lastUpdated ? (
          <p className="text-xs font-semibold text-muted">
            Data last updated on {lastUpdated}
            {cropDataset.source ? ` • Source: ${cropDataset.source}` : ""}
          </p>
        ) : null}
      </header>

      <GrowGardenCropValueCalculatorClient
        crops={cropDataset.crops}
        variants={GAG_VARIANTS}
        mutations={GAG_MUTATIONS}
        metaLastUpdated={lastUpdated}
        introHtml={introHtml}
        howHtml={howHtml}
      />
    </div>
  );
}
