import "./globals.css";
import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, organizationJsonLd, siteJsonLd } from "@/lib/seo";

const GlobalSearchOverlay = dynamic(
  () =>
    import("@/components/GlobalSearchOverlay").then((mod) => ({
      default: mod.GlobalSearchOverlay
    })),
  { ssr: false, loading: () => null }
);

const themeScript = `(() => {
  const storageKey = "roblox-codes-theme";
  try {
    const stored = window.localStorage.getItem(storageKey);
    const theme = stored === "light" || stored === "dark" ? stored : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  } catch (error) {
    /* noop */
  }
})();`;

const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [siteJsonLd({ siteUrl: SITE_URL }), organizationJsonLd({ siteUrl: SITE_URL })]
});
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  generator: "Next.js",
  title: {
    default: `${SITE_NAME} — Active & Working Codes`,
    template: "%s"
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Roblox codes",
    "Roblox game codes",
    "Bloxodes",
    "gaming rewards",
    "promo codes"
  ],
  category: "Gaming",
  publisher: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1
    }
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Active & Working Codes`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Roblox Codes`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Active & Working Codes`,
    description: SITE_DESCRIPTION,
    creator: "@bloxodes",
    site: "@bloxodes",
    images: [`${SITE_URL}/og-image.png`]
  },
  alternates: {
    canonical: SITE_URL,
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` }
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" }
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: ["/favicon.ico"]
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const requiresConsent = headerList.get("x-require-consent") === "1";

  return (
    <html lang="en" suppressHydrationWarning className="dark" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://www.roblox.com" />
        <link rel="preconnect" href="https://images.rbxcdn.com" />
        <link rel="preconnect" href="https://bmwksaykcsndsvgspapz.supabase.co" />
        <link rel="preconnect" href="https://robloxden.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="preconnect" href="https://lh3.ggpht.com" />
      </head>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <ConsentProvider requiresConsent={requiresConsent}>
          <ConsentBanner />
          <ConsentGate category="analytics">
            <GoogleAnalytics measurementId={googleAnalyticsId} />
            <Analytics />
            <SpeedInsights />
          </ConsentGate>
          <GlobalSearchOverlay />
          {children}
        </ConsentProvider>
      </body>
    </html>
  );
}
