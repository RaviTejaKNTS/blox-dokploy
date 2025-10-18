import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import sharp from "sharp";

type GameRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  cover_image: string | null;
  roblox_link: string | null;
  community_link: string | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
};

type UploadParams = {
  imageUrl: string;
  slug: string;
  gameName: string;
};

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE", "SUPABASE_MEDIA_BUCKET"] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY ?? "";
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX ?? "";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function googleSearch(query: string, limit = 5): Promise<string[]> {
  if (!GOOGLE_SEARCH_KEY || !GOOGLE_SEARCH_CX) {
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&num=${limit}&key=${GOOGLE_SEARCH_KEY}&cx=${GOOGLE_SEARCH_CX}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`⚠️ Google search failed (${response.status}): ${response.statusText}`);
    return [];
  }
  const data = (await response.json()) as { items?: { link?: string }[] };
  return (data.items ?? [])
    .map((item) => item.link)
    .filter((link): link is string => typeof link === "string" && link.length > 0);
}

async function fetchRobloxThumbnailViaApi(gameUrl: string): Promise<string | null> {
  try {
    const placeMatch = gameUrl.match(/roblox\.com\/(?:games|game-details|experiences)\/(\d+)/i);
    const placeId = placeMatch ? placeMatch[1] : null;
    if (!placeId) return null;

    const placeDetailsRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!placeDetailsRes.ok) return null;

    const placeDetails = await placeDetailsRes.json();
    const universeId = Array.isArray(placeDetails) && placeDetails[0]?.universeId;
    if (!universeId) return null;

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/games/multiget-thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      }
    );

    if (!thumbRes.ok) return null;
    const thumbs = await thumbRes.json();
    const imageUrl = thumbs?.data?.[0]?.imageUrl;
    return typeof imageUrl === "string" ? imageUrl : null;
  } catch (error) {
    console.warn("⚠️ Roblox thumbnail API failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchRobloxExperienceThumbnail(gameUrl: string): Promise<string | null> {
  try {
    const viaApi = await fetchRobloxThumbnailViaApi(gameUrl);
    if (viaApi) {
      return viaApi;
    }

    const response = await fetch(gameUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html, { url: gameUrl });
    const { document } = dom.window;

    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    if (ogImage) {
      try {
        return new URL(ogImage, gameUrl).toString();
      } catch {
        /* ignore bad URL */
      }
    }

    const primaryImage = document.querySelector("img") as HTMLImageElement | null;
    if (primaryImage?.src) {
      try {
        return new URL(primaryImage.src, gameUrl).toString();
      } catch {
        /* ignore bad URL */
      }
    }

    return null;
  } catch (error) {
    console.warn("⚠️ Failed to fetch Roblox thumbnail:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchPrimaryImageFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const metaOg = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
    if (metaOg?.content) return metaOg.content;

    const metaTwitter = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null;
    if (metaTwitter?.content) return metaTwitter.content;

    const img = document.querySelector("img") as HTMLImageElement | null;
    if (img?.src) return img.src;
  } catch (error) {
    console.warn("⚠️ Failed to extract image from", url, error instanceof Error ? error.message : error);
  }

  return null;
}

async function findRobloxImageUrl(gameName: string): Promise<string | null> {
  const query = `site:roblox.com ${gameName} game`;
  const results = await googleSearch(query, 4);

  for (const candidate of results) {
    if (!candidate || !/roblox\.com\//i.test(candidate)) continue;
    const image = await fetchPrimaryImageFromPage(candidate);
    if (image) return image;
    await sleep(1000);
  }

  return null;
}

async function downloadResizeAndUploadImage(params: UploadParams): Promise<string | null> {
  const response = await fetch(params.imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    console.warn("⚠️ Failed to download image:", response.statusText);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const resized = await sharp(buffer)
    .resize(1200, 675, { fit: "cover", position: "attention" })
    .webp({ quality: 90, effort: 4 })
    .toBuffer();

  const fileBase =
    params.gameName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/(^-|-$)/g, "") || params.slug;

  const fileName = `${fileBase}-codes.webp`;
  const path = `games/${params.slug}/${fileName}`;

  const bucket = process.env.SUPABASE_MEDIA_BUCKET!;
  const storageClient = supabase.storage.from(bucket);

  const { error } = await storageClient.upload(path, resized, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    console.error("⚠️ Failed to upload cover image:", error.message);
    return null;
  }

  const publicUrl = storageClient.getPublicUrl(path);
  return publicUrl.data.publicUrl;
}

async function selectImageForGame(game: GameRecord): Promise<string | null> {
  const linkCandidates = [
    game.roblox_link,
    game.community_link,
    game.source_url,
    game.source_url_2,
    game.source_url_3,
  ].filter((value): value is string => Boolean(value));

  for (const link of linkCandidates) {
    if (!link) continue;
    const image = await fetchRobloxExperienceThumbnail(link);
    if (image) return image;
  }

  return findRobloxImageUrl(game.name ?? game.slug ?? "");
}

async function main() {
  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, cover_image, roblox_link, community_link, source_url, source_url_2, source_url_3")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load games: ${error.message}`);
  }

  const games = (data ?? []).filter(
    (game): game is GameRecord =>
      Boolean(game) &&
      (!game.cover_image || String(game.cover_image).trim().length === 0)
  );

  if (!games.length) {
    console.log("✅ All games already have cover images.");
    return;
  }

  console.log(`▶ Processing ${games.length} game(s) missing cover images...`);

  let updated = 0;
  let skipped = 0;

  for (const game of games) {
    if (!game.slug) {
      console.warn(`⚠️ ${game.name ?? game.id}: missing slug, skipping.`);
      skipped += 1;
      continue;
    }

    console.log(`🖼️ Working on ${game.name ?? game.slug}...`);

    try {
      const imageUrl = await selectImageForGame(game);
      if (!imageUrl) {
        console.warn(`⚠️ No image found for ${game.name ?? game.slug}.`);
        skipped += 1;
        continue;
      }

      const uploadedUrl = await downloadResizeAndUploadImage({
        imageUrl,
        slug: game.slug,
        gameName: game.name ?? game.slug,
      });

      if (!uploadedUrl) {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("games")
        .update({ cover_image: uploadedUrl })
        .eq("id", game.id);

      if (updateError) {
        console.error(`⚠️ Failed to update ${game.name ?? game.slug}:`, updateError.message);
        skipped += 1;
        continue;
      }

      updated += 1;
      console.log(`✅ Cover image stored for ${game.name ?? game.slug}`);
    } catch (err) {
      console.error(`❌ Error processing ${game.name ?? game.slug}:`, err instanceof Error ? err.message : err);
      skipped += 1;
    }

    await sleep(500);
  }

  console.log("\nSummary");
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
}

main().catch((error) => {
  console.error("❌ Cover backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
