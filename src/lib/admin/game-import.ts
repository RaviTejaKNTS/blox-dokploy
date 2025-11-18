import { scrapeSources } from "@/lib/scraper";
import { normalizeGameSlug } from "@/lib/slug";

type ComputeArgs = {
  slug?: string | null;
  name?: string | null;
  sourceUrl: string;
};

export function computeGameDetails({ slug, name, sourceUrl }: ComputeArgs): { slug: string; name: string } {
  const trimmedSlug = slug?.trim();
  const trimmedName = name?.trim();

  const deriveNameFromSlug = (value: string | null | undefined) => {
    if (!value) return null;
    return value
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  };

  const deriveSlugFromUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const last = parts.pop();
      if (last) return last;
    } catch {
      // ignore
    }
    return null;
  };

  const baseSlug = trimmedSlug || deriveSlugFromUrl(sourceUrl) || trimmedName || sourceUrl;
  const finalSlug = normalizeGameSlug(trimmedName || baseSlug, baseSlug);
  const finalName = trimmedName || deriveNameFromSlug(finalSlug) || "Untitled Game";

  return { slug: finalSlug, name: finalName };
}

type SyncResult = {
  codesFound: number;
  codesUpserted: number;
  errors: string[];
};

/**
 * Lightweight placeholder for syncing codes.
 * Scrapes provided URLs and reports counts, but does not write to the database.
 * Extend with real upsert logic if/when needed.
 */
export async function syncGameCodesFromSources(
  _sb: any,
  _gameId: string,
  urls: Array<string | null | undefined>
): Promise<SyncResult> {
  const uniqueUrls = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));
  if (!uniqueUrls.length) {
    return { codesFound: 0, codesUpserted: 0, errors: ["No source URLs provided"] };
  }

  try {
    const scraped = await scrapeSources(uniqueUrls);
    const total = (scraped.codes?.length ?? 0) + (scraped.expiredCodes?.length ?? 0);
    return {
      codesFound: total,
      codesUpserted: 0,
      errors: []
    };
  } catch (error) {
    return {
      codesFound: 0,
      codesUpserted: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}
