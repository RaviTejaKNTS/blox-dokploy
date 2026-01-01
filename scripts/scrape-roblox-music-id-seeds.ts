import "dotenv/config";

import { writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const OUTPUT_FILE = process.env.ROBLOX_MUSIC_SEED_OUTPUT ?? "docs/roblox-music-id-seeds-v3.md";
const ROBLOXDEN_PAGES = clampNumber(process.env.ROBLOX_MUSIC_SEED_DEN_PAGES, 248, 1, 2000);
const ROBLOXSONG_PAGES = clampNumber(process.env.ROBLOX_MUSIC_SEED_SONG_PAGES, 50, 1, 500);
const REQUEST_DELAY_MS = clampNumber(process.env.ROBLOX_MUSIC_SEED_DELAY_MS, 150, 0, 10000);
const REQUEST_TIMEOUT_MS = clampNumber(process.env.ROBLOX_MUSIC_SEED_TIMEOUT_MS, 20000, 5000, 60000);
const MAX_RETRIES = clampNumber(process.env.ROBLOX_MUSIC_SEED_RETRIES, 3, 0, 10);
const RETRY_BASE_MS = clampNumber(process.env.ROBLOX_MUSIC_SEED_RETRY_BASE_MS, 400, 100, 10000);
const RETRY_JITTER_MS = clampNumber(process.env.ROBLOX_MUSIC_SEED_RETRY_JITTER_MS, 200, 0, 5000);
const USER_AGENT = process.env.ROBLOX_MUSIC_SEED_UA ?? "curl/8.7.1";
const DEN_SAMPLE_ID = process.env.ROBLOX_MUSIC_SEED_DEN_SAMPLE ?? "168208965";
const SONG_SAMPLE_ID = process.env.ROBLOX_MUSIC_SEED_SONG_SAMPLE ?? "1846088038";

const ROBLOXDEN_BASE = "https://robloxden.com/music-codes";
const ROBLOXSONG_BASE = "https://robloxsong.com/";

const ID_PATTERN = /^\d{5,}$/;

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function withJitter(ms: number) {
  if (!RETRY_JITTER_MS) return ms;
  return ms + Math.floor(Math.random() * RETRY_JITTER_MS);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  let attempt = 0;
  while (true) {
    await sleep(REQUEST_DELAY_MS);
    try {
      const res = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": USER_AGENT
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= MAX_RETRIES) {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Failed to fetch ${url} (${res.status}): ${body.slice(0, 200)}`);
        }
        return await res.text();
      }
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
    }

    const backoff = withJitter(RETRY_BASE_MS * Math.pow(2, attempt));
    attempt += 1;
    await sleep(backoff);
  }
}

function extractRobloxDenIds(html: string): string[] {
  const $ = cheerio.load(html);
  const ids = new Set<string>();

  $("a[href*=\"roblox.com/library/\"]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/roblox\.com\/library\/(\d+)/);
    if (match && ID_PATTERN.test(match[1])) {
      ids.add(match[1]);
    }
  });

  $("span.code span[contenteditable=\"true\"]").each((_, el) => {
    const text = $(el).text().trim();
    if (ID_PATTERN.test(text)) {
      ids.add(text);
    }
  });

  return Array.from(ids);
}

function extractRobloxSongIds(html: string): string[] {
  const $ = cheerio.load(html);
  const ids: string[] = [];
  $("span.songs__id-number").each((_, el) => {
    const text = $(el).text().trim();
    if (ID_PATTERN.test(text)) {
      ids.push(text);
    }
  });
  return ids;
}

async function scrapeSource(
  label: string,
  totalPages: number,
  buildUrl: (page: number) => string,
  extractIds: (html: string) => string[]
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= totalPages; page += 1) {
    const url = buildUrl(page);
    const html = await fetchHtml(url);
    const pageIds = extractIds(html);
    if (!pageIds.length) {
      console.warn(`[${label}] No IDs found on page ${page}: ${url}`);
    }
    for (const id of pageIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (page % 10 === 0 || page === totalPages) {
      console.log(`[${label}] ${page}/${totalPages} pages; ${ids.length} unique IDs so far.`);
    }
  }

  return ids;
}

async function run() {
  console.log(`Scraping RobloxDen (${ROBLOXDEN_PAGES} pages)...`);
  const denIds = await scrapeSource(
    "RobloxDen",
    ROBLOXDEN_PAGES,
    (page) => (page === 1 ? ROBLOXDEN_BASE : `${ROBLOXDEN_BASE}/${page}`),
    extractRobloxDenIds
  );

  console.log(`Scraping RobloxSong (${ROBLOXSONG_PAGES} pages)...`);
  const songIds = await scrapeSource(
    "RobloxSong",
    ROBLOXSONG_PAGES,
    (page) => (page === 1 ? ROBLOXSONG_BASE : `${ROBLOXSONG_BASE}?page=${page}`),
    extractRobloxSongIds
  );

  if (!denIds.includes(DEN_SAMPLE_ID)) {
    console.warn(`[RobloxDen] Sample ID not found: ${DEN_SAMPLE_ID}`);
  }
  if (!songIds.includes(SONG_SAMPLE_ID)) {
    console.warn(`[RobloxSong] Sample ID not found: ${SONG_SAMPLE_ID}`);
  }

  const combined = new Set([...denIds, ...songIds]);
  const lines = [
    "# Music ID seeds from web sources",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Sources:",
    `- RobloxDen: ${ROBLOXDEN_BASE} (pages 1-${ROBLOXDEN_PAGES})`,
    `- RobloxSong: ${ROBLOXSONG_BASE} (pages 1-${ROBLOXSONG_PAGES})`,
    "",
    "## Summary",
    `- RobloxDen IDs: ${denIds.length}`,
    `- RobloxSong IDs: ${songIds.length}`,
    `- Combined unique IDs: ${combined.size}`,
    "",
    "## RobloxDen IDs",
    "```",
    ...denIds,
    "```",
    "",
    "## RobloxSong IDs",
    "```",
    ...songIds,
    "```",
    ""
  ];

  await writeFile(OUTPUT_FILE, lines.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT_FILE}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
