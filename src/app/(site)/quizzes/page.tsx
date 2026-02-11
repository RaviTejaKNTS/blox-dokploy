import type { Metadata } from "next";
import { QUIZZES_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadQuizzesPageData, renderQuizzesPage } from "./page-data";

export const revalidate = 21600; // 6 hours

export const metadata: Metadata = {
  title: `Roblox Quizzes | ${SITE_NAME}`,
  description: QUIZZES_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/quizzes`),
  openGraph: {
    type: "website",
    url: `${SITE_URL}/quizzes`,
    title: `Roblox Quizzes | ${SITE_NAME}`,
    description: QUIZZES_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Quizzes | ${SITE_NAME}`,
    description: QUIZZES_DESCRIPTION
  }
};

export default async function QuizzesPage() {
  const { cards, total } = await loadQuizzesPageData();
  return renderQuizzesPage({ cards, total });
}
