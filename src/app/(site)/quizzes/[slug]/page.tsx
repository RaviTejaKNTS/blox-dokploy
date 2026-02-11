import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/QuizRunner";
import { getQuizPageByCode, loadQuizData } from "@/lib/quizzes";
import { markdownToPlainText } from "@/lib/markdown";
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

  return (
    <QuizRunner
      quizCode={page.code}
      title={page.title}
      description={description}
      questions={quizData}
      heroImage={heroImage}
      heroAlt={heroAlt}
    />
  );
}
