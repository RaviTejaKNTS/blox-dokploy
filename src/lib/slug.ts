export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function appendCodesSuffix(value: string) {
  const base = slugify(value);
  if (!base) return "";
  return base.endsWith("-codes") ? base : `${base}-codes`;
}

export function normalizeGameSlug(input?: string | null, fallback?: string | null) {
  const source = input?.trim() || fallback?.trim() || "";
  return appendCodesSuffix(source);
}

export function slugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.pop() ?? null;
  } catch {
    return null;
  }
}

export function titleizeGameSlug(slug: string) {
  const base = slug.replace(/-codes$/i, "");
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveGameName(opts: {
  name?: string | null;
  slug?: string | null;
  sourceUrl?: string | null;
}) {
  const trimmedName = opts.name?.trim();
  if (trimmedName) return trimmedName;

  const slugCandidate = opts.slug?.trim() || slugFromUrl(opts.sourceUrl) || "";
  const normalized = normalizeGameSlug(slugCandidate);
  if (!normalized) return "";
  return titleizeGameSlug(normalized);
}
