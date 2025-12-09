"use client";

import type { ReactNode } from "react";
import { useConsent } from "./ConsentProvider";

type ConsentCategory = "analytics" | "marketing";

export function ConsentGate({ category, children }: { category: ConsentCategory; children: ReactNode }) {
  const { state, requiresConsent, shouldShowBanner } = useConsent();

  if (!requiresConsent) {
    return <>{children}</>;
  }

  // Block non-essential scripts until a decision is made.
  if (shouldShowBanner) {
    return null;
  }

  const allowed = category === "marketing" ? state.marketing : state.analytics;
  return allowed ? <>{children}</> : null;
}
