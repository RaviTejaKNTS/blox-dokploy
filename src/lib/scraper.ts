import { URL } from "node:url";
import { scrapeRobloxdenPage } from "./robloxden";
import { scrapeBeebomPage } from "./beebom";
import { scrapeProGameGuidesPage } from "./progameguides";
import { scrapeDestructoidPage } from "./destructoid";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const SCRAPER_MAP = {
  robloxden: scrapeRobloxdenPage,
  beebom: scrapeBeebomPage,
  // Temporarily disabled
  // progameguides: scrapeProGameGuidesPage,
  // destructoid: scrapeDestructoidPage,
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
  // progameguides: 0,
  // destructoid: 1,
  robloxden: 2,
  beebom: 3,
};

function getProviderPriority(provider?: ScrapedCode["provider"]): number {
  if (!provider) return -1;
  return PROVIDER_PRIORITY[provider] ?? -1;
}

const CODE_DISPLAY_PRIORITY: Record<NonNullable<ScrapedCode["provider"]>, number> = {
  // progameguides: 0,
  // destructoid: 1,
  robloxden: 2,
  beebom: 3,
};

export function getCodeDisplayPriority(provider?: ScrapedCode["provider"]): number {
  if (!provider) return 0;
  return CODE_DISPLAY_PRIORITY[provider] ?? 0;
}

const REWARD_PRIORITY: Record<NonNullable<ScrapedCode["provider"]>, number> = {
  // progameguides: 0,
  // destructoid: 1,
  robloxden: 2,
  beebom: 3,
};

function getRewardPriority(provider?: ScrapedCode["provider"]): number {
  if (!provider) return -1;
  return REWARD_PRIORITY[provider] ?? -1;
}

type AggregatedEntry = {
  data: ScrapedCode;
  codePriority: number;
  rewardPriority: number;
};

function mergeCodeEntry(existing: AggregatedEntry, incoming: ScrapedCode): AggregatedEntry {
  const merged = { ...existing };
  const result = merged.data;

  const incomingStatusPriority = STATUS_PRIORITY[incoming.status];
  const existingStatusPriority = STATUS_PRIORITY[result.status];
  if (incomingStatusPriority > existingStatusPriority) {
    result.status = incoming.status;
  }

  if (incoming.levelRequirement != null && result.levelRequirement == null) {
    result.levelRequirement = incoming.levelRequirement;
  }

  result.isNew = Boolean(result.isNew || incoming.isNew);

  const incomingProviderPriority = getProviderPriority(incoming.provider);
  const existingProviderPriority = getProviderPriority(result.provider);
  if (incomingProviderPriority > existingProviderPriority) {
    result.provider = incoming.provider;
  } else if (!result.provider && incoming.provider) {
    result.provider = incoming.provider;
  }

  const incomingReward = incoming.rewardsText?.trim();
  if (incomingReward) {
    const incomingRewardPriority = getRewardPriority(incoming.provider);
    if (
      incomingRewardPriority > merged.rewardPriority ||
      !result.rewardsText?.trim()
    ) {
      result.rewardsText = incomingReward;
      merged.rewardPriority = incomingRewardPriority;
    }
  }

  const incomingCodePriority = getCodeDisplayPriority(incoming.provider);
  if (incomingCodePriority > merged.codePriority) {
    result.code = incoming.code.trim();
    merged.codePriority = incomingCodePriority;
    result.providerPriority = incomingCodePriority;
  } else {
    const existingPriority = result.providerPriority ?? merged.codePriority;
    if (incomingCodePriority > existingPriority) {
      result.providerPriority = incomingCodePriority;
    } else if (result.providerPriority == null) {
      result.providerPriority = existingPriority;
    }
  }

  return merged;
}

export function mergeScrapeResults(results: ScrapeResult[]): ScrapeResult {
  const map = new Map<string, AggregatedEntry>();
  const order: string[] = [];
  const expiredMap = new Map<string, { code: string; priority: number }>();
  const expiredCandidates: { normalized: string; code: string; priority: number }[] = [];

  for (const result of results) {
    for (const codeEntry of result.codes) {
      const normalizedCode = normalizeCodeKey(codeEntry.code);
      if (!normalizedCode) continue;
      const existing = map.get(normalizedCode);
      if (!existing) {
        const sanitizedCode = codeEntry.code.trim();
        map.set(normalizedCode, {
          data: {
            ...codeEntry,
            code: sanitizedCode,
            rewardsText: codeEntry.rewardsText?.trim() || undefined,
            providerPriority: getCodeDisplayPriority(codeEntry.provider),
          },
          codePriority: getCodeDisplayPriority(codeEntry.provider),
          rewardPriority: getRewardPriority(codeEntry.provider),
        });
        order.push(normalizedCode);
      } else {
        const merged = mergeCodeEntry(existing, codeEntry);
        map.set(normalizedCode, merged);
      }
    }

    for (const expired of result.expiredCodes ?? []) {
      const code = typeof expired === "string" ? expired.trim() : expired.code?.trim();
      const provider = typeof expired === "string" ? undefined : expired.provider;
      if (!code) continue;
      const normalizedExpired = normalizeCodeKey(code);
      if (!normalizedExpired) continue;
      const incomingPriority = getCodeDisplayPriority(provider);
      expiredCandidates.push({ normalized: normalizedExpired, code, priority: incomingPriority });
    }
  }

  for (const candidate of expiredCandidates) {
    const aggregated = map.get(candidate.normalized);
    const hasHigherPriorityActive =
      aggregated && aggregated.data.status === "active" && (aggregated.codePriority ?? 0) > candidate.priority;
    if (hasHigherPriorityActive) continue;

    const existing = expiredMap.get(candidate.normalized);
    if (!existing || candidate.priority > existing.priority) {
      expiredMap.set(candidate.normalized, { code: candidate.code, priority: candidate.priority });
    }
  }

  const mergedCodes = order
    .map((key) => map.get(key)?.data)
    .filter((entry): entry is ScrapedCode => Boolean(entry));
  const mergedExpired = Array.from(expiredMap.values()).map((entry) => entry.code);
  return { codes: mergedCodes, expiredCodes: mergedExpired };
}

export function detectProvider(url: string): Provider | null {
  const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  if (host.endsWith("robloxden.com")) return "robloxden";
  if (host.endsWith("beebom.com")) return "beebom";
  // Paused providers: skip instead of failing the whole run
  if (host.endsWith("progameguides.com")) return null;
  if (host.endsWith("destructoid.com")) return null;
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
  const skippedProviders = new Set<string>();
  for (const url of unique) {
    const provider = detectProvider(url);
    if (!provider) {
      skippedProviders.add(url);
      continue;
    }
    const scraper = SCRAPER_MAP[provider];
    const result = await scraper(url);
    results.push(result);
  }

  if (skippedProviders.size) {
    const skippedList = Array.from(skippedProviders).join(", ");
    console.warn(`Skipped disabled providers for: ${skippedList}`);
  }

  return mergeScrapeResults(results);
}
