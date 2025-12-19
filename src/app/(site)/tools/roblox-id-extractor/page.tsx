import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContent, type ToolContent, type ToolFaqEntry } from "@/lib/tools";
import { RobloxIdExtractorClient } from "./RobloxIdExtractorClient";
import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 3600;

const TOOL_CODE = "roblox-id-extractor";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/${TOOL_CODE}`;
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
  let tool = (await getToolContent(TOOL_CODE)) ?? null;

  // Dev fallback: allow draft content to render locally even if not published.
  if (!tool && process.env.NODE_ENV !== "production") {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("tools")
      .select(
        "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at"
      )
      .eq("code", TOOL_CODE)
      .maybeSingle();
    tool = (data as ToolContent | null) ?? null;
  }
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
  let tool = await getToolContent(TOOL_CODE);
  if (!tool && process.env.NODE_ENV !== "production") {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("tools")
      .select(
        "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at"
      )
      .eq("code", TOOL_CODE)
      .maybeSingle();
    tool = (data as ToolContent | null) ?? null;
  }
  if (!tool) {
    return {
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

export default async function RobloxIdExtractorPage() {
  const { tool, introHtml, howHtml, descriptionHtml, faqHtml } = await buildToolContent();
  const publishedTime = tool?.published_at ?? tool?.created_at ?? null;
  const modifiedTime = tool?.updated_at ?? tool?.published_at ?? tool?.created_at ?? null;

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
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
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
          applicationCategory: "Utility",
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

      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {tool?.title ?? "Roblox ID Extractor"}
        </h1>
        {introHtml ? (
          <div className="prose dark:prose-invert game-copy max-w-3xl" dangerouslySetInnerHTML={{ __html: introHtml }} />
        ) : null}
      </header>

      <div className="mt-8">
        <RobloxIdExtractorClient />
      </div>

      {(descriptionHtml.length || howHtml || faqHtml.length) ? (
        <div className="space-y-6">
          {descriptionHtml.length ? (
            <section className="prose dark:prose-invert game-copy max-w-3xl space-y-6">
              {descriptionHtml.map((entry) => (
                <div key={entry.key} dangerouslySetInnerHTML={{ __html: entry.html }} />
              ))}
            </section>
          ) : null}

          {howHtml ? (
            <section className="prose dark:prose-invert game-copy max-w-3xl space-y-2">
              <div dangerouslySetInnerHTML={{ __html: howHtml }} />
            </section>
          ) : null}

          {faqHtml.length ? (
            <section className="rounded-2xl border border-border/60 bg-surface/40 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">FAQ</h2>
              <div className="mt-3 space-y-4">
                {faqHtml.map((faq, idx) => (
                  <div key={`${faq.q}-${idx}`} className="rounded-xl border border-border/40 bg-background/60 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Q.</span>
                      <p className="text-base font-semibold text-foreground">{faq.q}</p>
                    </div>
                    <div
                      className="prose mt-2 text-[0.98rem] text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: faq.a }}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
