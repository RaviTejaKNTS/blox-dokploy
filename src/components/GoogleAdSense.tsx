import { headers } from "next/headers";
import Script from "next/script";

type GoogleAdSenseProps = {
  clientId?: string;
  excludePrefix?: string;
};

export function GoogleAdSense({ clientId, excludePrefix = "/admin" }: GoogleAdSenseProps) {
  if (!clientId) {
    return null;
  }

  const headerList = headers();
  const requestUrl = headerList.get("x-middleware-request-url");

  if (requestUrl) {
    try {
      const pathname = new URL(requestUrl).pathname;
      if (excludePrefix && pathname.startsWith(excludePrefix)) {
        return null;
      }
    } catch {
      /* ignore malformed URLs */
    }
  }

  return (
    <Script
      id="google-adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
