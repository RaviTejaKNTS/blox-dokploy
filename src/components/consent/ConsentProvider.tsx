"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
  updatedAt: number | null;
};

type ConsentContextValue = {
  state: ConsentState;
  requiresConsent: boolean;
  shouldShowBanner: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (next: Partial<Pick<ConsentState, "analytics" | "marketing">>) => void;
};

const STORAGE_KEY = "gdpr-consent";
const REQUIRE_CONSENT_COOKIE = "require-consent";

const defaultBlockedState: ConsentState = {
  analytics: false,
  marketing: false,
  decided: false,
  updatedAt: null
};

const defaultAllowedState: ConsentState = {
  analytics: true,
  marketing: true,
  decided: true,
  updatedAt: Date.now()
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readRequiresConsentFromCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const cookieString = document.cookie || "";
  const entries = cookieString.split(";").map((part) => part.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [name, value] = entry.split("=");
    if (name === REQUIRE_CONSENT_COOKIE) {
      return value === "1";
    }
  }
  return null;
}

function readStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decided: Boolean(parsed.decided),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}

function persist(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export function ConsentProvider({ requiresConsent: initialRequiresConsent = true, children }: { requiresConsent?: boolean; children: ReactNode }) {
  const [requiresConsent, setRequiresConsent] = useState<boolean>(initialRequiresConsent);
  const [state, setState] = useState<ConsentState>(() =>
    initialRequiresConsent ? defaultBlockedState : defaultAllowedState
  );
  const [hydrated, setHydrated] = useState(false);

  // On mount, hydrate from storage or auto-allow if consent is not required.
  useEffect(() => {
    const cookieValue = readRequiresConsentFromCookie();
    const shouldRequireConsent = cookieValue ?? initialRequiresConsent;
    setRequiresConsent(shouldRequireConsent);

    const stored = readStoredConsent();
    if (stored) {
      setState(stored);
      setHydrated(true);
      return;
    }

    if (!shouldRequireConsent) {
      setState(defaultAllowedState);
    } else {
      setState(defaultBlockedState);
    }
    setHydrated(true);
  }, [initialRequiresConsent]);

  const setAndPersist = (next: ConsentState) => {
    setState(next);
    persist(next);
  };

  const acceptAll = () => {
    setAndPersist({
      analytics: true,
      marketing: true,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const rejectAll = () => {
    setAndPersist({
      analytics: false,
      marketing: false,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const updateConsent = (next: Partial<Pick<ConsentState, "analytics" | "marketing">>) => {
    setAndPersist({
      analytics: next.analytics ?? state.analytics,
      marketing: next.marketing ?? state.marketing,
      decided: true,
      updatedAt: Date.now()
    });
  };

  const value = useMemo<ConsentContextValue>(
    () => ({
      state,
      requiresConsent,
      shouldShowBanner: hydrated && requiresConsent && !state.decided,
      acceptAll,
      rejectAll,
      updateConsent
    }),
    [state, requiresConsent, hydrated]
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}
