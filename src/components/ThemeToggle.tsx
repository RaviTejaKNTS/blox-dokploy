"use client";

import { useEffect, useState, useTransition } from "react";
import { trackEvent } from "@/lib/analytics";
import { updateThemePreference } from "@/app/actions/preferences";
import { THEME_COOKIE, type Theme, normalizeTheme } from "@/lib/theme";

function readThemeCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${THEME_COOKIE}=`));
  if (!cookie) return null;
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  return normalizeTheme(value);
}

function resolvePreferredTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }

  const rootTheme = normalizeTheme(document.documentElement.dataset.theme ?? null);
  if (rootTheme) return rootTheme;

  return readThemeCookie() ?? "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const preferred = resolvePreferredTheme();
    setTheme(preferred);
    applyTheme(preferred);
    setHydrated(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=31536000`;
    startTransition(() => {
      updateThemePreference(next).catch(() => null);
    });
    trackEvent("theme_toggle", { theme: next });
  };

  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      disabled={isPending}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface-muted text-foreground shadow-soft transition hover:-translate-y-[1px] hover:border-border/40 hover:bg-surface"
    >
      <span className="sr-only">{label}</span>
      {hydrated ? (
        theme === "light" ? (
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
          </svg>
        )
      ) : (
        <span aria-hidden className="block h-2 w-2 rounded-full bg-muted" />
      )}
    </button>
  );
}
