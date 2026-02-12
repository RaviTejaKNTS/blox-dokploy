import "./globals.css";
import { ReactNode } from "react";
import Script from "next/script";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { ConsentMode } from "@/components/consent/ConsentMode";
import { GoogleAdSense } from "@/components/GoogleAdSense";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { LayoutClientAnalytics, LayoutGlobalSearch } from "@/components/LayoutClient";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, organizationJsonLd, siteJsonLd } from "@/lib/seo";
import { THEME_COOKIE } from "@/lib/theme";

const themeScript = `(() => {
  const cookieKey = "${THEME_COOKIE}";
  try {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(cookieKey + "="));
    const value = cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
    const theme = value === "light" || value === "dark" ? value : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  } catch (error) {
    /* noop */
  }
})();`;

const consentModeScript = `(() => {
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};

    var requireCookie = document.cookie
      .split("; ")
      .find(function(row){return row.startsWith("require-consent=");});
    var requiresConsent = requireCookie ? requireCookie.split("=").slice(1).join("=") === "1" : true;

    var stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem("gdpr-consent") || "null");
    } catch (error) {
      stored = null;
    }

    var decided = stored && typeof stored.decided === "boolean" ? stored.decided : false;
    var analytics = stored && typeof stored.analytics === "boolean" ? stored.analytics : false;
    var marketing = stored && typeof stored.marketing === "boolean" ? stored.marketing : false;

    if (!requiresConsent) {
      decided = true;
      analytics = true;
      marketing = true;
    }

    var signal = {
      ad_storage: !requiresConsent || (decided && marketing) ? "granted" : "denied",
      analytics_storage: !requiresConsent || (decided && analytics) ? "granted" : "denied",
      ad_user_data: !requiresConsent || (decided && marketing) ? "granted" : "denied",
      ad_personalization: !requiresConsent || (decided && marketing) ? "granted" : "denied",
      wait_for_update: 500
    };

    window.gtag("consent", "default", signal);
    window.__bloxodesConsentDefaultsSet = true;
    window.__bloxodesConsentDefaults = {
      ad_storage: signal.ad_storage,
      analytics_storage: signal.analytics_storage,
      ad_user_data: signal.ad_user_data,
      ad_personalization: signal.ad_personalization
    };
    window.__bloxodesConsent = {
      requiresConsent: requiresConsent,
      decided: decided,
      analytics: analytics,
      marketing: marketing
    };
  } catch (error) {
    /* noop */
  }
})();`;

const growInitializerScript = `!(function(){window.growMe||((window.growMe=function(e){window.growMe._.push(e);}),(window.growMe._=[]));var e=document.createElement("script");(e.type="text/javascript"),(e.src="https://faves.grow.me/main.js"),(e.defer=!0),e.setAttribute("data-grow-faves-site-id","U2l0ZTo3NWQ5YWI3ZC0yNjhjLTRlMDMtYmI2Yy0xODBjYTRiOGQ1ZWQ=");var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t);})();`;
const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [siteJsonLd({ siteUrl: SITE_URL }), organizationJsonLd({ siteUrl: SITE_URL })]
});
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const googleAdSenseClientId =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID ?? "ca-pub-5243258773824278";
const alternatesTypes = { "application/rss+xml": `${SITE_URL}/feed.xml` };
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
    canonical: "./",
    types: alternatesTypes
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
  verification: {
    google: "m-QfA406lK-3WGDXN0yV6Cv8hXoLI0RBnJBtndIyAp4"
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://www.roblox.com" />
        <link rel="preconnect" href="https://images.rbxcdn.com" />
        <link rel="preconnect" href="https://bmwksaykcsndsvgspapz.supabase.co" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="preconnect" href="https://lh3.ggpht.com" />
      </head>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: consentModeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <Script id="grow-initializer" strategy="afterInteractive">
          {growInitializerScript}
        </Script>
        <ConsentProvider>
          <ConsentMode />
          <ConsentBanner />
          <ConsentGate category="analytics">
            <GoogleAnalytics measurementId={googleAnalyticsId} />
            <LayoutClientAnalytics />
          </ConsentGate>
          <ConsentGate category="marketing">
            <GoogleAdSense clientId={googleAdSenseClientId} />
          </ConsentGate>
          <AnalyticsTracker />
          <LayoutGlobalSearch />
          {children}
        </ConsentProvider>
      </body>
    </html>
  );
}
