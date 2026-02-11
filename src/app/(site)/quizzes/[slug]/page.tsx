import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { QuizRunner } from "@/components/QuizRunner";
import { getQuizPageByCode, loadQuizData } from "@/lib/quizzes";
import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";
import type { QuizData, QuizQuestion } from "@/lib/quiz-types";
import { QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";

export const revalidate = 3600; // 1 hour

type PageProps = {
  params: Promise<{ slug: string }>;
};

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

function flattenQuestions(quizData: QuizData): QuizQuestion[] {
  return [...(quizData.easy ?? []), ...(quizData.medium ?? []), ...(quizData.hard ?? [])];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getQuizPageByCode(slug);
  if (!page) return {};

  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title;
  const description =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : QUIZZES_DESCRIPTION);
  const canonical = `${SITE_URL}/quizzes/${page.code}`;
  const thumb = pickThumbnail(page.universe?.thumbnail_urls);
  const image = thumb || page.universe?.icon_url || `${SITE_URL}/og-image.png`;

  return {
    title: `${titleBase} | ${SITE_NAME}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: titleBase,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title: titleBase,
      description,
      images: [image]
    }
  };
}

export default async function QuizPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getQuizPageByCode(slug);
  if (!page) {
    notFound();
  }

  const quizData = await loadQuizData(page.code);
  if (!quizData) {
    notFound();
  }

  const description = page.description_md
    ? markdownToPlainText(page.description_md).replace(/\s+/g, " ").trim()
    : null;
  const descriptionHtml = page.description_md
    ? await renderMarkdown(page.description_md, { paragraphizeLineBreaks: true })
    : "";
  const aboutHtml = page.about_md
    ? await renderMarkdown(page.about_md, { paragraphizeLineBreaks: true })
    : "";
  const heroImage = pickThumbnail(page.universe?.thumbnail_urls) || page.universe?.icon_url || null;
  const gameName = page.universe?.display_name ?? page.universe?.name ?? page.title;
  const heroAlt = `${gameName} Quiz Thumbnail`;
  const canonical = `${SITE_URL}/quizzes/${page.code}`;
  const publishedTime = page.published_at || page.created_at || null;
  const modifiedTime = page.content_updated_at || page.updated_at || publishedTime || null;
  const updatedDateValue = modifiedTime;
  const updatedDate = updatedDateValue ? new Date(updatedDateValue) : null;
  const formattedUpdated = updatedDate
    ? updatedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const updatedRelativeLabel = updatedDate ? formatDistanceToNow(updatedDate, { addSuffix: true }) : null;
  const allQuestions = flattenQuestions(quizData);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: page.title,
        description: description ?? QUIZZES_DESCRIPTION,
        url: canonical,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Quizzes", item: `${SITE_URL}/quizzes` },
            { "@type": "ListItem", position: 3, name: page.title }
          ]
        },
        mainEntity: { "@id": `${canonical}#quizapp` }
      },
      {
        "@type": "WebApplication",
        "@id": `${canonical}#quizapp`,
        name: page.title,
        description: description ?? QUIZZES_DESCRIPTION,
        url: canonical,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "en",
        image: heroImage ? [heroImage] : undefined,
        isPartOf: {
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL
        },
        about: {
          "@type": "ItemList",
          itemListElement: allQuestions.map((question, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Question",
              name: question.question
            }
          }))
        }
      }
    ]
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs uppercase tracking-[0.25em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="flex items-center gap-2">
            <a href="/" className="font-semibold text-muted transition hover:text-accent">
              Home
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <a href="/quizzes" className="font-semibold text-muted transition hover:text-accent">
              Quizzes
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-foreground/80">{page.title}</span>
          </li>
        </ol>
      </nav>
      <QuizRunner
        quizCode={page.code}
        title={page.title}
        description={description}
        descriptionHtml={descriptionHtml}
        updatedLabel={formattedUpdated}
        updatedRelativeLabel={updatedRelativeLabel}
        questions={quizData}
        heroImage={heroImage}
        heroAlt={heroAlt}
      />
      {aboutHtml ? (
        <section className="mt-10 border-t border-border/60 pt-6" id="about">
          <div
            className="prose dark:prose-invert max-w-none game-copy"
            dangerouslySetInnerHTML={{ __html: aboutHtml }}
          />
        </section>
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
