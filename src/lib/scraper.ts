import { URL } from "node:url";
import { scrapeRobloxdenPage } from "./robloxden";
import { scrapeBeebomPage } from "./beebom";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const SCRAPER_MAP = {
  robloxden: scrapeRobloxdenPage,
  beebom: scrapeBeebomPage,
} as const;

type Provider = keyof typeof SCRAPER_MAP;

function normalizeCodeKey(code: string): string {
  return code.replace(/\s+/g, "").trim().toUpperCase();
}

const STATUS_PRIORITY: Record<ScrapedCode["status"], number> = {
  active: 2,
  check: 1,
};

function mergeCodeEntry(existing: ScrapedCode, incoming: ScrapedCode): ScrapedCode {
  const merged: ScrapedCode = { ...existing };

  if (STATUS_PRIORITY[incoming.status] > STATUS_PRIORITY[existing.status]) {
    merged.status = incoming.status;
  }

  if (incoming.levelRequirement != null && merged.levelRequirement == null) {
    merged.levelRequirement = incoming.levelRequirement;
  }

  merged.isNew = Boolean(existing.isNew || incoming.isNew);

  const incomingReward = incoming.rewardsText?.trim();
  const existingReward = merged.rewardsText?.trim();

  if (incoming.provider === "robloxden") {
    if (incomingReward) {
      merged.rewardsText = incomingReward;
    }
    merged.provider = "robloxden";
  } else {
    if (!existingReward && incomingReward) {
      merged.rewardsText = incomingReward;
      merged.provider = merged.provider ?? "beebom";
    }
  }

  return merged;
}

export function mergeScrapeResults(results: ScrapeResult[]): ScrapeResult {
  const map = new Map<string, ScrapedCode>();
  const order: string[] = [];
  const expired = new Map<string, string>();

  for (const result of results) {
    for (const codeEntry of result.codes) {
      const normalizedCode = normalizeCodeKey(codeEntry.code);
      if (!normalizedCode) continue;
      const existing = map.get(normalizedCode);
      if (!existing) {
        const sanitizedCode = codeEntry.code.trim();
        map.set(normalizedCode, {
          ...codeEntry,
          code: sanitizedCode,
          rewardsText: codeEntry.rewardsText?.trim() || undefined,
        });
        order.push(normalizedCode);
      } else {
        const merged = mergeCodeEntry(existing, codeEntry);
        map.set(normalizedCode, merged);
      }
    }
    for (const expiredCode of result.expiredCodes) {
      const normalizedCode = normalizeCodeKey(expiredCode);
      if (normalizedCode && !expired.has(normalizedCode)) {
        const sanitized = expiredCode.trim();
        expired.set(normalizedCode, sanitized || normalizedCode);
      }
    }
  }

  const mergedCodes = order.map((key) => map.get(key)!).filter(Boolean);
  const expiredCodes = Array.from(expired.values());

  return { codes: mergedCodes, expiredCodes };
}

export function detectProvider(url: string): Provider {
  const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  if (host.endsWith("robloxden.com")) return "robloxden";
  if (host.endsWith("beebom.com")) return "beebom";
  throw new Error(`Unsupported source host: ${host}`);
}

export async function scrapeSources(urls: string[]): Promise<ScrapeResult> {
  const unique = Array.from(
    new Set(
      urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter((url) => url.length > 0)
    )
  );

  if (unique.length === 0) {
    return { codes: [], expiredCodes: [] };
  }

  const results: ScrapeResult[] = [];
  for (const url of unique) {
    const provider = detectProvider(url);
    const scraper = SCRAPER_MAP[provider];
    const result = await scraper(url);
    results.push(result);
  }

  return mergeScrapeResults(results);
}
