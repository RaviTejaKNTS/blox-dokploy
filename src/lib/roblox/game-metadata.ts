import * as cheerio from "cheerio";

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const AUTH_COOKIE = process.env.ROBLOX_AUTH_COOKIE ?? process.env.ROBLOSECURITY ?? null;

export type RobloxGameMetadata = {
  genre: string | null;
  subGenre: string | null;
  placeId: string | null;
  universeId: string | null;
  communityLink: string | null;
};

export function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

export function normalizeCommunityLink(raw?: string | null, baseUrl?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl ?? "https://www.roblox.com");
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("roblox.com")) {
      return null;
    }
    const path = url.pathname.toLowerCase();
    const isCommunityPath =
      path.startsWith("/communities/") || path.startsWith("/users/") || path.startsWith("/groups/");
    if (!isCommunityPath) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function extractPlaceId(link: string): string | null {
  try {
    const url = new URL(link);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const gamesIndex = pathSegments.findIndex((segment) => segment === "games" || segment === "game");
    if (gamesIndex !== -1 && pathSegments[gamesIndex + 1]) {
      const candidate = pathSegments[gamesIndex + 1].replace(/[^0-9]/g, "");
      return candidate || null;
    }
    const match = link.match(/placeId=(\d+)/i);
    if (match) return match[1];
  } catch {
    /* noop */
  }
  return null;
}

export async function fetchGenreFromApi(placeId: string): Promise<{ genre: string | null; subGenre: string | null }> {
  const endpoint = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`;
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      referer: "https://www.roblox.com/",
      ...(AUTH_COOKIE ? { cookie: `.ROBLOSECURITY=${AUTH_COOKIE}` } : {})
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for place ${placeId}: ${response.status}`);
  }
  const payload = (await response.json()) as Array<{
    genre?: string | null;
    genreDisplayName?: string | null;
    subgenre?: string | null;
    subgenreDisplayName?: string | null;
  }>;
  const entry = payload?.[0];
  if (!entry) {
    return { genre: null, subGenre: null };
  }
  const genre = normalizeText(entry.genreDisplayName || entry.genre || null);
  const subGenre = normalizeText(entry.subgenreDisplayName || entry.subgenre || null);
  return { genre, subGenre };
}

export async function fetchGenreFromUniverse(
  universeId: string
): Promise<{ genre: string | null; subGenre: string | null }> {
  const endpoint = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
      referer: "https://www.roblox.com/",
      ...(AUTH_COOKIE ? { cookie: `.ROBLOSECURITY=${AUTH_COOKIE}` } : {})
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch universe ${universeId}: ${response.status}`);
  }
  const payload = (await response.json()) as { data?: Array<{ genre?: string | null; genreDisplayName?: string | null }> };
  const entry = payload?.data?.[0];
  if (!entry) {
    return { genre: null, subGenre: null };
  }
  const genre = normalizeText(entry.genreDisplayName || entry.genre || null);
  return { genre, subGenre: null };
}

export async function scrapeRobloxGameMetadata(url: string): Promise<RobloxGameMetadata> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(AUTH_COOKIE ? { cookie: `.ROBLOSECURITY=${AUTH_COOKIE}` } : {})
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load Roblox page ${url}: ${response.status}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  let genre: string | null = null;
  let subGenre: string | null = null;

  $("li.game-stat").each((_, element) => {
    const label =
      normalizeText($(element).find(".text-label").text()) ??
      normalizeText($(element).find("p").first().text());
    const value =
      normalizeText($(element).find(".text-lead").text()) ??
      normalizeText($(element).find(".font-caption-body").text()) ??
      normalizeText($(element).find("p").eq(1).text());

    if (!label || !value) return;
    const lower = label.toLowerCase();
    if (lower === "genre") {
      genre = value;
    } else if (lower === "subgenre" || lower === "sub-genre") {
      subGenre = value;
    }
  });

  const meta = $("#game-detail-meta-data");
  const placeId = meta.attr("data-place-id") ?? null;
  const universeId = meta.attr("data-universe-id") ?? null;
  const creatorLink =
    $(".game-calls-to-action .game-creator a.text-name").attr("href") ??
    $(".game-calls-to-action .game-creator a").attr("href") ??
    null;

  return {
    genre: normalizeText(genre),
    subGenre: normalizeText(subGenre),
    placeId,
    universeId,
    communityLink: normalizeCommunityLink(creatorLink, url)
  };
}
