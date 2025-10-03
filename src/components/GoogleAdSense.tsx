import { headers } from "next/headers";

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
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
    />
  );
}

