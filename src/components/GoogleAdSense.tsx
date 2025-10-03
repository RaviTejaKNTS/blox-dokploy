"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

type GoogleAdSenseProps = {
  clientId?: string;
};

const adminPrefix = "/admin";

export function GoogleAdSense({ clientId }: GoogleAdSenseProps) {
  const pathname = usePathname();

  if (!clientId) {
    return null;
  }

  if (pathname && pathname.startsWith(adminPrefix)) {
    return null;
  }

  return (
    <Script
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

