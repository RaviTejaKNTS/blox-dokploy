import { URL } from "node:url";
import { scrapeRobloxdenPage } from "./robloxden";
import { scrapeBeebomPage } from "./beebom";
import { scrapeProGameGuidesPage } from "./progameguides";
import { scrapeDestructoidPage } from "./destructoid";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const SCRAPER_MAP = {
  robloxden: scrapeRobloxdenPage,
  beebom: scrapeBeebomPage,
  progameguides: scrapeProGameGuidesPage,
  destructoid: scrapeDestructoidPage,
} as const;

type Provider = keyof typeof SCRAPER_MAP;

function normalizeCodeKey(code: string): string {
  return code.replace(/\s+/g, "").trim().toUpperCase();
}

const STATUS_PRIORITY: Record<ScrapedCode["status"], number> = {
  active: 2,
  check: 1,
};

const PROVIDER_PRIORITY: Record<NonNullable<ScrapedCode["provider"]>, number> = {
  progameguides: 0,
  destructoid: 1,
  beebom: 2,
  robloxden: 3,
};

function getProviderPriority(provider?: ScrapedCode["provider"]): number {
  if (!provider) return -1;
  return PROVIDER_PRIORITY[provider] ?? -1;
}

function mergeCodeEntry(existing: ScrapedCode, incoming: ScrapedCode): ScrapedCode {
  const merged: ScrapedCode = { ...existing };
  const incomingPriority = getProviderPriority(incoming.provider);
  const existingPriority = getProviderPriority(existing.provider);

  if (STATUS_PRIORITY[incoming.status] > STATUS_PRIORITY[existing.status]) {
    merged.status = incoming.status;
  }

  if (incoming.levelRequirement != null && merged.levelRequirement == null) {
    merged.levelRequirement = incoming.levelRequirement;
  }

  merged.isNew = Boolean(existing.isNew || incoming.isNew);

  const incomingReward = incoming.rewardsText?.trim();
  const existingReward = merged.rewardsText?.trim();

  if (incomingPriority > existingPriority) {
    merged.code = incoming.code.trim();
    merged.provider = incoming.provider;
    if (incomingReward) {
      merged.rewardsText = incomingReward;
    }
  } else {
    if (!merged.provider && incoming.provider) {
      merged.provider = incoming.provider;
    }
    if (!existingReward && incomingReward) {
      merged.rewardsText = incomingReward;
    }
  }

  return merged;
}

export function mergeScrapeResults(results: ScrapeResult[]): ScrapeResult {
  const map = new Map<string, ScrapedCode>();
  const order: string[] = [];

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
  }

  const mergedCodes = order.map((key) => map.get(key)!).filter(Boolean);
  return { codes: mergedCodes, expiredCodes: [] };
}

export function detectProvider(url: string): Provider {
  const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  if (host.endsWith("robloxden.com")) return "robloxden";
  if (host.endsWith("beebom.com")) return "beebom";
  if (host.endsWith("progameguides.com")) return "progameguides";
  if (host.endsWith("destructoid.com")) return "destructoid";
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
