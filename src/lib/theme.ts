export type Theme = "light" | "dark";

export const THEME_COOKIE = "bloxodes-theme";

export function normalizeTheme(value: string | null | undefined): Theme | null {
  if (value === "light" || value === "dark") return value;
  return null;
}
