"use client";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  const win = window as {
    gtag?: (...args: unknown[]) => void;
    __ga4Initialized?: boolean;
    __bloxodesConsent?: {
      requiresConsent: boolean;
      analytics: boolean;
      decided: boolean;
    };
  };
  if (!win.__ga4Initialized) return;
  const consent = win.__bloxodesConsent;
  if (consent?.requiresConsent) {
    if (!consent.decided || !consent.analytics) return;
  }
  const gtag = win.gtag;
  if (typeof gtag !== "function") return;

  const cleaned: Record<string, string | number | boolean> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      cleaned[key] = value;
    }
  }

  gtag("event", eventName, cleaned);
}
