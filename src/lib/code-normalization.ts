export function sanitizeCodeDisplay(code: string | null | undefined): string | null {
  if (typeof code !== "string") {
    return null;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export function normalizeCodeKey(code: string | null | undefined): string | null {
  const sanitized = sanitizeCodeDisplay(code);
  if (!sanitized) {
    return null;
  }

  return sanitized.replace(/\s+/g, "").toUpperCase();
}
