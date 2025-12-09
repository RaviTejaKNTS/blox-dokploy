"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "./consent/ConsentProvider";

type GoogleAdSenseProps = {
  clientId?: string;
  excludePrefix?: string;
  idleDelay?: number;
};

const DEFAULT_IDLE_DELAY = 4000;

type IdleWindow = typeof window & {
  requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, opts?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
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

export function GoogleAdSense({
  clientId,
  excludePrefix = "/admin",
  idleDelay = DEFAULT_IDLE_DELAY
}: GoogleAdSenseProps) {
  const pathname = usePathname();
  const [shouldLoad, setShouldLoad] = useState(false);
  // Respect marketing consent (ads) before loading.
  const { requiresConsent, state, shouldShowBanner } = useConsent();

  const isBlockedRoute = useMemo(() => {
    if (!excludePrefix) return false;
    return Boolean(pathname && pathname.startsWith(excludePrefix));
  }, [pathname, excludePrefix]);

  const marketingAllowed = useMemo(() => {
    if (!requiresConsent) return true;
    if (shouldShowBanner) return false;
    return state.marketing;
  }, [requiresConsent, shouldShowBanner, state.marketing]);

  useEffect(() => {
    if (!clientId || isBlockedRoute || !marketingAllowed) {
      return;
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
  }, [clientId, idleDelay, isBlockedRoute, marketingAllowed]);

  useEffect(() => {
    if (!shouldLoad || !clientId || !marketingAllowed) {
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-adsbygoogle-client="${clientId}"]`
    );

    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-adsbygoogle-client", clientId);
    document.head.appendChild(script);

    return () => {
      // We intentionally keep the script once loaded to avoid repeated network work.
    };
  }, [shouldLoad, clientId, marketingAllowed]);

  if (!marketingAllowed || !clientId) {
    return null;
  }

  return null;
}
