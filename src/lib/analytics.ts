"use client";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (typeof window === "undefined") return;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
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
