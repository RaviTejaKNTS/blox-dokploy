"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

type GoogleAnalyticsProps = {
  measurementId?: string;
};

const adminPrefix = "/admin";

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();

  if (!measurementId) {
    return null;
  }

  if (pathname && pathname.startsWith(adminPrefix)) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
