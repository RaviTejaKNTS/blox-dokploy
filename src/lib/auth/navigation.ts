export const DEFAULT_AUTH_NEXT_PATH = "/account";

export function sanitizeNextPath(rawNext: string | null | undefined, fallback = DEFAULT_AUTH_NEXT_PATH): string {
  if (!rawNext) return fallback;
  if (!rawNext.startsWith("/")) return fallback;
  if (rawNext.startsWith("//") || rawNext.includes("\\")) return fallback;
  if (rawNext.startsWith("/auth/")) return fallback;
  return rawNext;
}
