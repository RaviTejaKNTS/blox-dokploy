import * as cheerio from "cheerio";

export type SocialLinkType = "roblox" | "community" | "discord" | "twitter" | "youtube";

export type SocialLinks = Partial<Record<SocialLinkType, string>>;

export type SocialLinkDetail = {
  provider: Provider;
  sourceUrl: string;
  value: string;
};

export type Provider = "beebom" | "robloxden" | "destructoid";

type ProviderResult = {
  provider: Provider;
  sourceUrl: string;
  links: SocialLinks;
};

const PROVIDER_PRIORITY: Provider[] = ["beebom", "robloxden", "destructoid"];
const PROVIDER_RANK: Record<Provider, number> = {
  beebom: 0,
  robloxden: 1,
  destructoid: 2
};

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesSocialBot/1.0)";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "mkt_tok",
  "utm_name",
  "utm_reader",
  "utm_place",
  "utm_social",
  "utm_social-type"
];

function stripTrackingParams(url: URL) {
  for (const key of TRACKING_PARAMS) {
    url.searchParams.delete(key);
  }
}

function normalizeAbsoluteUrl(raw: string | undefined, baseUrl: string): URL | null {
  if (!raw) return null;
  try {
    const resolved = new URL(raw.trim(), baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    resolved.hash = "";
    stripTrackingParams(resolved);
    return resolved;
  } catch {
    return null;
  }
}

function detectSocialProvider(rawUrl: string): Provider | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.endsWith("beebom.com")) return "beebom";
    if (host.endsWith("robloxden.com")) return "robloxden";
    if (host.endsWith("destructoid.com")) return "destructoid";
  } catch {
    return null;
  }
  return null;
}

function isRobloxExperiencePath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname.includes("/games/") || pathname.includes("/game/")) return true;
  if (searchParams.has("placeId") || searchParams.has("universeId")) return true;
  return false;
}

function isRobloxCommunityPath(pathname: string): boolean {
  return pathname.includes("/communities/") || pathname.includes("/users/");
}

function classifyLink(url: URL): SocialLinkType | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (host.endsWith("roblox.com")) {
    if (isRobloxExperiencePath(pathname, url.searchParams)) {
      return "roblox";
    }
    if (isRobloxCommunityPath(pathname)) {
      return "community";
    }
    return null;
  }

  if (host === "discord.gg" || host.endsWith("discord.com")) {
    return "discord";
  }

  if (host === "x.com" || host.endsWith("twitter.com")) {
    return "twitter";
  }

  if (host.endsWith("youtube.com") || host === "youtu.be" || host === "m.youtube.com") {
    return "youtube";
  }

  return null;
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const html = await response.text();
  return cheerio.load(html);
}

function extractLinksFromAnchors(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<cheerio.Element>,
  baseUrl: string
): SocialLinks {
  const result: SocialLinks = {};
  root.find("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const normalized = normalizeAbsoluteUrl(href, baseUrl);
    if (!normalized) return;
    const type = classifyLink(normalized);
    if (!type) return;
    if (!result[type]) {
      result[type] = normalized.toString();
    }
  });
  return result;
}

async function scrapeRobloxdenLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const sidebar = $(".section__side").first();
  if (!sidebar.length) {
    return {};
  }
  const links: SocialLinks = {};
  sidebar.find("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const normalized = normalizeAbsoluteUrl(href, url);
    if (!normalized) return;
    const type = classifyLink(normalized);
    if (type === "roblox" && !links.roblox) {
      links.roblox = normalized.toString();
    }
  });
  return links;
}

async function scrapeBeebomLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container = $(".beebom-single-content.entry-content.highlight");
  if (!container.length) {
    return {};
  }
  return extractLinksFromAnchors($, container, url);
}

async function scrapeDestructoidLinks(url: string): Promise<SocialLinks> {
  const $ = await fetchHtml(url);
  const container = $(".wp-block-gamurs-article-content");
  if (!container.length) {
    return {};
  }
  return extractLinksFromAnchors($, container, url);
}

export async function scrapeSocialLinksFromUrl(url: string): Promise<ProviderResult | null> {
  const provider = detectSocialProvider(url);
  if (!provider) {
    return null;
  }

  let links: SocialLinks = {};
  switch (provider) {
    case "beebom":
      links = await scrapeBeebomLinks(url);
      break;
    case "robloxden":
      links = await scrapeRobloxdenLinks(url);
      break;
    case "destructoid":
      links = await scrapeDestructoidLinks(url);
      break;
    default:
      break;
  }

  return { provider, sourceUrl: url, links };
}

export async function scrapeSocialLinksFromSources(
  urls: string[]
): Promise<{ links: SocialLinks; details: Partial<Record<SocialLinkType, SocialLinkDetail>>; errors: string[] }> {
  const unique = Array.from(
    new Set(
      urls
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    )
  );

  const candidates: Array<ProviderResult & { order: number }> = [];
  const errors: string[] = [];

  for (const [index, rawUrl] of unique.entries()) {
    try {
      const result = await scrapeSocialLinksFromUrl(rawUrl);
      if (result) {
        candidates.push({ ...result, order: index });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
    }
  }

  if (candidates.length === 0) {
    return { links: {}, details: {}, errors };
  }

  candidates.sort((a, b) => {
    const priorityDiff = PROVIDER_RANK[a.provider] - PROVIDER_RANK[b.provider];
    if (priorityDiff !== 0) return priorityDiff;
    return a.order - b.order;
  });

  const merged: SocialLinks = {};
  const details: Partial<Record<SocialLinkType, SocialLinkDetail>> = {};

  for (const candidate of candidates) {
    for (const [type, value] of Object.entries(candidate.links) as [SocialLinkType, string][]) {
      if (value && !merged[type]) {
        merged[type] = value;
        details[type] = {
          provider: candidate.provider,
          sourceUrl: candidate.sourceUrl,
          value
        };
      }
    }
  }

  return { links: merged, details, errors };
}

export const SOCIAL_LINK_FIELDS: SocialLinkType[] = ["roblox", "community", "discord", "twitter", "youtube"];

export function providerPriorityList(): Provider[] {
  return [...PROVIDER_PRIORITY];
}
