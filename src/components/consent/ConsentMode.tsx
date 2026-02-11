"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "./ConsentProvider";

type ConsentSignal = {
  ad_storage: "granted" | "denied";
  analytics_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

type ConsentWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  __bloxodesConsent?: {
    requiresConsent: boolean;
    analytics: boolean;
    marketing: boolean;
    decided: boolean;
  };
  __bloxodesConsentDefaultsSet?: boolean;
  __bloxodesConsentDefaults?: ConsentSignal;
};

const DEFAULT_WAIT_FOR_UPDATE_MS = 500;

function buildConsentSignal(requiresConsent: boolean, decided: boolean, analytics: boolean, marketing: boolean) {
  if (!requiresConsent) {
    return {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    } satisfies ConsentSignal;
  }

  if (!decided) {
    return {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    } satisfies ConsentSignal;
  }

  return {
    ad_storage: marketing ? "granted" : "denied",
    analytics_storage: analytics ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied"
  } satisfies ConsentSignal;
}

function signalsEqual(a: ConsentSignal, b: ConsentSignal) {
  return (
    a.ad_storage === b.ad_storage &&
    a.analytics_storage === b.analytics_storage &&
    a.ad_user_data === b.ad_user_data &&
    a.ad_personalization === b.ad_personalization
  );
}

export function ConsentMode() {
  const { requiresConsent, state } = useConsent();
  const lastSignalRef = useRef<ConsentSignal | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as ConsentWindow;
    win.dataLayer = win.dataLayer ?? [];

    if (typeof win.gtag !== "function") {
      win.gtag = function gtag() {
        win.dataLayer?.push(arguments);
      };
    }

    const decided = requiresConsent ? state.decided : true;
    const analyticsAllowed = requiresConsent ? state.analytics : true;
    const marketingAllowed = requiresConsent ? state.marketing : true;
    const nextSignal = buildConsentSignal(requiresConsent, decided, analyticsAllowed, marketingAllowed);

    win.__bloxodesConsent = {
      requiresConsent,
      decided,
      analytics: analyticsAllowed,
      marketing: marketingAllowed
    };

    const defaults = win.__bloxodesConsentDefaults;
    if (!lastSignalRef.current && defaults) {
      lastSignalRef.current = defaults;
    }

    if (!win.__bloxodesConsentDefaultsSet) {
      win.gtag?.("consent", "default", {
        ...nextSignal,
        wait_for_update: DEFAULT_WAIT_FOR_UPDATE_MS
      });
      win.__bloxodesConsentDefaultsSet = true;
      win.__bloxodesConsentDefaults = nextSignal;
      lastSignalRef.current = nextSignal;
      return;
    }

    if (!lastSignalRef.current || !signalsEqual(lastSignalRef.current, nextSignal)) {
      win.gtag?.("consent", "update", nextSignal);
      lastSignalRef.current = nextSignal;
    }
  }, [requiresConsent, state.analytics, state.marketing, state.decided]);

  return null;
}
