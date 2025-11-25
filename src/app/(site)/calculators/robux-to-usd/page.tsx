import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { fetchRobuxBundles } from "./robux-bundles";
import { RobuxPurchaseClient } from "./RobuxPurchaseClient";

const PAGE_TITLE = "Robux to USD Calculator — Roblox Purchase Planner";
const PAGE_DESCRIPTION =
  "Estimate how many Robux you can buy on PC/Web or Mobile/Microsoft Store, with or without Roblox Premium. See the bundles, prices, and effective cost before tax.";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/calculators/robux-to-usd`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: CANONICAL
  },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: SITE_NAME,
    images: [`${SITE_URL}/og-image.png`]
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`]
  }
};

export default async function RobloxPurchasePage() {
  const bundles = await fetchRobuxBundles();
  return <RobuxPurchaseClient bundles={bundles} />;
}
