"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

function toSnakeCase(value: string) {
  return value
    .replace(/^[A-Z]/, (match) => match.toLowerCase())
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function coerceValue(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

function extractAnalyticsParams(element: HTMLElement) {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (!key.startsWith("analytics") || key === "analyticsEvent") continue;
    if (typeof value !== "string" || value.length === 0) continue;
    const paramKey = toSnakeCase(key.replace(/^analytics/, ""));
    params[paramKey] = coerceValue(value) as string | number | boolean;
  }
  return params;
}

export function AnalyticsTracker() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const analyticsElement = target.closest<HTMLElement>("[data-analytics-event]");
      if (analyticsElement) {
        const eventName = analyticsElement.dataset.analyticsEvent;
        if (eventName) {
          const params = extractAnalyticsParams(analyticsElement);
          if (eventName === "social_follow_click") {
            const link = target.closest<HTMLAnchorElement>("a[href]");
            if (link && params.link_url === undefined) {
              params.link_url = link.href;
            }
          }
          trackEvent(eventName, params);
        }
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin === window.location.origin) return;
      if (url.protocol !== "http:" && url.protocol !== "https:") return;

      const linkContext =
        anchor.dataset.analyticsLinkContext || anchor.dataset.linkContext || window.location.pathname;

      trackEvent("outbound_click", {
        link_url: url.href,
        link_domain: url.hostname,
        link_context: linkContext
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
