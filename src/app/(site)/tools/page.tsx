import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadToolsPageData, renderToolsPage } from "./page-data";

export const revalidate = 21600; // refresh a few times per day

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

export default async function ToolsPage() {
  const { tools, total, totalPages } = await loadToolsPageData(1);
  if (!tools) {
    notFound();
  }

  return renderToolsPage({
    tools,
    total,
    totalPages,
    currentPage: 1,
    showHero: true
  });
}
