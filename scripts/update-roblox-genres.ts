import "dotenv/config";

import { chromium, Browser } from "playwright";

import { supabaseAdmin } from "@/lib/supabase";

type GameRecord = {
  id: string;
  name: string;
  slug: string | null;
  roblox_link: string | null;
  genre: string | null;
  sub_genre: string | null;
};

type RobloxPlaceDetails = {
  placeId: number;
  universeId: number;
  name: string;
  genre?: string | null;
  genreDisplayName?: string | null;
  subgenre?: string | null;
  subgenreDisplayName?: string | null;
};

type RobloxUniverseDetails = {
  id: number;
  rootPlaceId: number;
  name: string;
  description: string;
  creator: { id: number; name: string; type: string };
  price: number | null;
  allowedGearTypes: string[];
  allowedGearCategories: string[];
  isGenreEnforced: boolean;
  genre?: string | null;
  genreDisplayName?: string | null;
};

type ScriptResult = {
  slug: string | null;
  name: string;
  status: "updated" | "skipped" | "error";
  genre?: string | null;
  subGenre?: string | null;
  error?: string;
};

const USER_AGENT =
  process.env.ROBLOX_SCRAPER_UA ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const AUTH_COOKIE =
  process.env.ROBLOX_AUTH_COOKIE ??
  process.env.ROBLOSECURITY ??
  null;

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

async function closeBrowser() {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function extractPlaceId(link: string): string | null {
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

async function fetchGenreFromApi(placeId: string): Promise<{ genre: string | null; subGenre: string | null }> {
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
  const payload = (await response.json()) as RobloxPlaceDetails[];
  const entry = payload?.[0];
  if (!entry) {
    return { genre: null, subGenre: null };
  }
  const genre = normalizeText(entry.genreDisplayName || entry.genre || null);
  const subGenre = normalizeText(entry.subgenreDisplayName || entry.subgenre || null);
  return { genre, subGenre };
}

async function fetchGenreFromUniverse(universeId: string): Promise<{ genre: string | null; subGenre: string | null }> {
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
  const payload = (await response.json()) as { data?: RobloxUniverseDetails[] };
  const entry = payload?.data?.[0];
  if (!entry) {
    return { genre: null, subGenre: null };
  }
  const genre = normalizeText(entry.genreDisplayName || entry.genre || null);
  return { genre, subGenre: null };
}

async function scrapeGamePage(
  url: string
): Promise<{ genre: string | null; subGenre: string | null; placeId: string | null; universeId: string | null }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1290, height: 720 },
    javaScriptEnabled: true
  });
  await context.addInitScript({
    content: `
      (function() {
        const globalAny = window;
        if (!globalAny.__defProp) {
          globalAny.__defProp = Object.defineProperty;
        }
        if (!globalAny.__name) {
          globalAny.__name = function(target, value) {
            if (globalAny.__defProp) {
              globalAny.__defProp(target, "name", { value, configurable: true });
            }
            return target;
          };
        }
      })();
    `
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.waitForSelector(".game-stat-container", { timeout: 20000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const __defProp = Object.defineProperty;
      const __name = (target: any, value: string) => __defProp(target, "name", { value, configurable: true });
      function normalize(value?: string | null) {
        if (!value) return null;
        return value.replace(/\s+/g, " ").trim();
      }
      const stats = Array.from(document.querySelectorAll("li.game-stat"));
      let genre: string | null = null;
      let subGenre: string | null = null;

      for (const stat of stats) {
        const label =
          normalize(stat.querySelector(".text-label")?.textContent) ??
          normalize(stat.querySelector("p")?.textContent);
        const value =
          normalize(stat.querySelector(".text-lead")?.textContent) ??
          normalize(stat.querySelector(".font-caption-body")?.textContent) ??
          normalize(stat.querySelector("p:nth-of-type(2)")?.textContent);
        if (!label || !value) continue;
        const lower = label.toLowerCase();
        if (lower === "genre") {
          genre = value;
        } else if (lower === "subgenre" || lower === "sub-genre") {
          subGenre = value;
        }
      }

      const meta = document.querySelector("#game-detail-meta-data");
      const placeId = meta?.getAttribute("data-place-id") ?? null;
      const universeId = meta?.getAttribute("data-universe-id") ?? null;

      return { genre, subGenre, placeId, universeId };
    });

    return {
      genre: normalizeText(data.genre),
      subGenre: normalizeText(data.subGenre),
      placeId: data.placeId,
      universeId: data.universeId
    };
  } finally {
    await context.close();
  }
}

async function updateGameGenre(sb: ReturnType<typeof supabaseAdmin>, game: GameRecord): Promise<ScriptResult> {
  const slug = game.slug ?? game.id;
  if (!game.roblox_link) {
    return { slug: game.slug, name: game.name, status: "skipped" };
  }

  try {
    const scraped = await scrapeGamePage(game.roblox_link);
    let genre = scraped.genre;
    let subGenre = scraped.subGenre;

    const placeIdFromMeta = scraped.placeId ?? extractPlaceId(game.roblox_link);
    const universeId = scraped.universeId ?? null;

    if ((!genre || !subGenre) && universeId) {
      try {
        const universeData = await fetchGenreFromUniverse(universeId);
        genre = genre ?? universeData.genre;
        subGenre = subGenre ?? universeData.subGenre;
      } catch (error) {
        console.warn(`Failed universe API for ${game.name} (${universeId}):`, error instanceof Error ? error.message : error);
      }
    }

    if ((!genre || !subGenre) && (placeIdFromMeta || game.roblox_link)) {
      const placeId = placeIdFromMeta ?? extractPlaceId(game.roblox_link);
      if (placeId) {
        try {
          const fallback = await fetchGenreFromApi(placeId);
          genre = genre ?? fallback.genre;
          subGenre = subGenre ?? fallback.subGenre;
        } catch (error) {
          console.warn(`Failed place API fallback for ${game.name} (${placeId}):`, error instanceof Error ? error.message : error);
        }
      }
    }

    const updates: Partial<GameRecord> = {};
    if (genre && genre !== game.genre) {
      updates.genre = genre;
    }
    if (subGenre && subGenre !== game.sub_genre) {
      updates.sub_genre = subGenre;
    }

    if (Object.keys(updates).length === 0) {
      return { slug: game.slug, name: game.name, status: "skipped", genre: game.genre, subGenre: game.sub_genre };
    }

    const { error } = await sb
      .from("games")
      .update(updates)
      .eq("id", game.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      slug: game.slug,
      name: game.name,
      status: "updated",
      genre: updates.genre ?? game.genre,
      subGenre: updates.sub_genre ?? game.sub_genre
    };
  } catch (error) {
    return {
      slug,
      name: game.name,
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseCliSlugs(): string[] {
  const args = process.argv.slice(2);
  const slugs: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--slug" || arg === "-s") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --slug");
      }
      slugs.push(value.trim());
      index += 1;
    } else if (arg.startsWith("--slug=")) {
      slugs.push(arg.slice("--slug=".length).trim());
    }
  }
  return slugs.filter(Boolean);
}

async function main() {
  const targetSlugs = new Set(parseCliSlugs());
  if (targetSlugs.size) {
    console.log(`Filtering to ${targetSlugs.size} slug(s): ${Array.from(targetSlugs).join(", ")}`);
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("id, name, slug, roblox_link, genre, sub_genre")
    .not("roblox_link", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const list = (data ?? []) as GameRecord[];
  const candidates = list.filter((game) => {
    if (targetSlugs.size && !targetSlugs.has(game.slug ?? "")) {
      return false;
    }
    return Boolean(game.roblox_link) && (!game.genre || !game.sub_genre);
  });

  if (!candidates.length) {
    console.log("No games require genre/sub-genre updates.");
    return;
  }

  console.log(`Checking ${candidates.length} game(s) for genre/sub-genre metadata…`);

  const results: ScriptResult[] = [];
  for (const game of candidates) {
    const result = await updateGameGenre(sb, game);
    results.push(result);
    if (result.status === "updated") {
      console.log(`✓ ${game.name} → Genre: ${result.genre ?? "unchanged"}, Sub-genre: ${result.subGenre ?? "unchanged"}`);
    } else if (result.status === "skipped") {
      console.log(`• Skipped ${game.name} (no new data)`);
    } else {
      console.warn(`⚠️  Failed for ${game.name}: ${result.error}`);
    }
    // Friendly delay to avoid hammering Roblox too quickly.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`\nDone. Updated ${updated}, skipped ${results.length - updated - errors}, errors ${errors}.`);
}

main()
  .then(async () => {
    await closeBrowser();
  })
  .catch(async (error) => {
    console.error(error);
    await closeBrowser();
    process.exit(1);
  });
