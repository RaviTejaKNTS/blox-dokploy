import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/QuizRunner";
import { getQuizPageByCode, loadQuizData } from "@/lib/quizzes";
import { markdownToPlainText } from "@/lib/markdown";
import type { QuizData, QuizOption, QuizQuestion } from "@/lib/quiz-types";
import { QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle } from "@/lib/seo";

export const revalidate = 3600; // 1 hour

type PageProps = {
  params: Promise<{ slug: string }>;
};

const QUESTION_COUNT = {
  easy: 5,
  medium: 5,
  hard: 5
} as const;

type Difficulty = keyof typeof QUESTION_COUNT;

type AttemptQuestion = QuizQuestion & { difficulty: Difficulty; options: QuizOption[] };

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

function buildStaticAttempt(quizData: QuizData): AttemptQuestion[] {
  const build = (difficulty: Difficulty) => {
    const list = quizData[difficulty] ?? [];
    return list.slice(0, QUESTION_COUNT[difficulty]).map((question) => ({
      ...question,
      difficulty,
      options: question.options ?? []
    }));
  };

  return [...build("easy"), ...build("medium"), ...build("hard")];
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
  const heroImage = pickThumbnail(page.universe?.thumbnail_urls) || page.universe?.icon_url || null;
  const heroAlt = page.universe?.display_name ?? page.universe?.name ?? page.title;
  const canonical = `${SITE_URL}/quizzes/${page.code}`;
  const publishedTime = page.published_at || page.created_at || null;
  const modifiedTime = page.content_updated_at || page.updated_at || publishedTime || null;
  const initialAttempt = buildStaticAttempt(quizData);
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
      <QuizRunner
        quizCode={page.code}
        title={page.title}
        description={description}
        questions={quizData}
        heroImage={heroImage}
        heroAlt={heroAlt}
        initialAttempt={initialAttempt}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
