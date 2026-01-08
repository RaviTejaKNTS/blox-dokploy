"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

type GoogleAnalyticsProps = {
  measurementId?: string;
  idleDelay?: number;
};

const adminPrefix = "/admin";
const DEFAULT_IDLE_DELAY = 5000;

type IdleWindow = typeof window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, opts?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type AnalyticsWindow = IdleWindow & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __ga4Initialized?: boolean;
};

function scheduleIdle(callback: () => void, delay: number) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleWin = window as IdleWindow;

  if (typeof idleWin.requestIdleCallback === "function") {
    const handle = idleWin.requestIdleCallback(() => callback(), { timeout: delay });
    return () => {
      idleWin.cancelIdleCallback?.(handle);
    };
  }

  const timeout = window.setTimeout(callback, delay);
  return () => {
    window.clearTimeout(timeout);
  };
}

export function GoogleAnalytics({ measurementId, idleDelay = DEFAULT_IDLE_DELAY }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);

  const isBlockedRoute = useMemo(() => {
    return Boolean(pathname && pathname.startsWith(adminPrefix));
  }, [pathname]);

  useEffect(() => {
    if (!measurementId || isBlockedRoute) {
      return;
    }

    if (typeof window !== "undefined") {
      const win = window as AnalyticsWindow;
      if (!Array.isArray(win.dataLayer)) {
        win.dataLayer = [];
      }
      if (typeof win.gtag !== "function") {
        win.gtag = function gtag() {
          win.dataLayer?.push(arguments);
        };
      }
      if (!win.__ga4Initialized) {
        win.gtag("js", new Date());
        win.gtag("config", measurementId);
        win.__ga4Initialized = true;
      }
    }

    let cancelled = false;

    const cancel = scheduleIdle(() => {
      if (!cancelled) {
        setShouldLoad(true);
      }
    }, idleDelay);

    return () => {
      cancelled = true;
      cancel();
    };
  }, [measurementId, idleDelay, isBlockedRoute]);

  if (!measurementId || isBlockedRoute || !shouldLoad) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          if (!window.__ga4Initialized) {
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}');
            window.__ga4Initialized = true;
          }
        `}
      </Script>
    </>
  );
}
