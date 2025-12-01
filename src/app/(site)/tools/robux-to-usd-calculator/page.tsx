import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContent, type ToolContent, type ToolFaqEntry } from "@/lib/tools";
import { fetchRobuxBundles } from "./robux-bundles";
import { RobuxPurchaseClient } from "./RobuxPurchaseClient";
import {
  DEFAULT_HAS_PREMIUM,
  DEFAULT_TARGET_ROBUX,
  DEFAULT_TARGET_USD,
  buildBudgetPlan,
  buildRobuxPlan,
  buildValueBundlePlan,
  selectBestRobuxPlan
} from "./robux-plans";

export const revalidate = 3600; // revalidate every hour to keep SSR/CSR snapshots aligned

const TOOL_CODE = "robux-to-usd-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/robux-to-usd-calculator`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

function sortDescriptionEntries(description: Record<string, string> | null | undefined) {
  return Object.entries(description ?? {}).sort((a, b) => {
    const left = Number.parseInt(a[0], 10);
    const right = Number.parseInt(b[0], 10);
    if (Number.isNaN(left) && Number.isNaN(right)) return a[0].localeCompare(b[0]);
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

async function buildToolContent(): Promise<{
  tool: ToolContent | null;
  introHtml: string;
  howHtml: string;
  descriptionHtml: Array<{ key: string; html: string }>;
  faqHtml: Array<{ q: string; a: string }>;
}> {
  const tool = (await getToolContent(TOOL_CODE)) ?? null;
  const introHtml = tool?.intro_md ? await renderMarkdown(tool.intro_md) : "";
  const howHtml = tool?.how_it_works_md ? await renderMarkdown(tool.how_it_works_md) : "";

  const descriptionEntries = sortDescriptionEntries(tool?.description_json ?? {});
  const descriptionHtml = await Promise.all(
    descriptionEntries.map(async ([key, value]) => ({
      key,
      html: await renderMarkdown(value ?? "")
    }))
  );

  const faqEntries: ToolFaqEntry[] = Array.isArray(tool?.faq_json) ? tool.faq_json : [];
  const faqHtml = await Promise.all(
    faqEntries.map(async (entry) => ({
      q: entry.q,
      a: await renderMarkdown(entry.a ?? "")
    }))
  );

  return {
    tool,
    introHtml,
    howHtml,
    descriptionHtml,
    faqHtml
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContent(TOOL_CODE);
  if (!tool) {
    return {
      alternates: { canonical: CANONICAL }
    };
  }

  const title = tool.seo_title ?? tool.title ?? undefined;
  const description = tool.meta_description ?? undefined;
  const image = tool.thumb_url || FALLBACK_IMAGE;

  return {
    title,
    description,
    alternates: {
      canonical: CANONICAL
    },
    openGraph: {
      type: "website",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function RobloxPurchasePage() {
  const { tool, introHtml, howHtml, descriptionHtml, faqHtml } = await buildToolContent();
  const bundles = await fetchRobuxBundles();
  const initialRobuxPlanPc = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "pc_web", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlanMobile = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "mobile", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlan = selectBestRobuxPlan(initialRobuxPlanPc, initialRobuxPlanMobile);
  const initialValuePlan = buildValueBundlePlan(DEFAULT_TARGET_ROBUX, DEFAULT_HAS_PREMIUM, bundles);
  const initialBudgetPlan = buildBudgetPlan(DEFAULT_TARGET_USD, DEFAULT_HAS_PREMIUM, bundles);

  const faqSchema =
    (tool?.faq_json?.length ?? 0) > 0
      ? tool!.faq_json.map((entry) => ({
          "@type": "Question",
          name: entry.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.a
          }
        }))
      : [];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: tool?.title ?? undefined,
        description: tool?.meta_description ?? undefined,
        url: CANONICAL,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "Tool" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? undefined,
          description: tool?.meta_description ?? undefined,
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      },
      ...(faqSchema.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqSchema
            }
          ]
        : [])
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
            <span className="font-semibold text-foreground/80">{tool?.title ?? "Tool"}</span>
          </li>
        </ol>
      </nav>
      <RobuxPurchaseClient
        bundles={bundles}
        initialRobuxTarget={DEFAULT_TARGET_ROBUX}
        initialUsdTarget={DEFAULT_TARGET_USD}
        initialHasPremium={DEFAULT_HAS_PREMIUM}
        initialRobuxPlan={initialRobuxPlan}
        initialValuePlan={initialValuePlan}
        initialBudgetPlan={initialBudgetPlan}
        title={tool?.title ?? null}
        introHtml={introHtml || null}
        howHtml={howHtml || null}
        descriptionHtml={descriptionHtml}
        faqHtml={faqHtml}
      />
    </>
  );
}
