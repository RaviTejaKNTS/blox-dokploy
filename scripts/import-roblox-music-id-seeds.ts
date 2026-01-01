import "dotenv/config";

import { readFile } from "node:fs/promises";
import { supabaseAdmin } from "@/lib/supabase";

const SEED_FILE = process.env.ROBLOX_MUSIC_SEED_FILE ?? "docs/roblox-music-id-seeds.md";
const SEED_SOURCE = process.env.ROBLOX_MUSIC_SEED_SOURCE ?? "seed_web";
const SEED_TITLE = process.env.ROBLOX_MUSIC_SEED_TITLE ?? "Unknown Title";
const SEED_ARTIST = process.env.ROBLOX_MUSIC_SEED_ARTIST ?? "Unknown Artist";
const UPSERT_CHUNK = clampNumber(process.env.ROBLOX_MUSIC_SEED_UPSERT_CHUNK, 200, 50, 1000);
const UPDATE_EXISTING = toBoolean(process.env.ROBLOX_MUSIC_SEED_UPDATE_EXISTING, false);

const ID_PATTERN = /^\d{5,12}$/;

const SECTION_MAP: Array<{ key: string; label: string }> = [
  { key: "robloxden", label: "RobloxDen" },
  { key: "robloxsong", label: "RobloxSong" }
];

type SeedRow = {
  asset_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  source: string;
  raw_payload: Record<string, unknown>;
  last_seen_at: string;
};

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseSeedFile(contents: string) {
  const sources = new Map<string, Set<string>>();
  SECTION_MAP.forEach((section) => sources.set(section.key, new Set()));

  let currentSection: string | null = null;
  let inCodeBlock = false;

  for (const line of contents.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      const label = line.slice(3).trim();
      const section = SECTION_MAP.find((entry) => entry.label === label);
      currentSection = section ? section.key : null;
      continue;
    }

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (!inCodeBlock || !currentSection) continue;
    const trimmed = line.trim();
    if (!ID_PATTERN.test(trimmed)) continue;
    sources.get(currentSection)?.add(trimmed);
  }

  const totalIds = new Set<string>();
  const idSources = new Map<string, string[]>();

  for (const [key, set] of sources.entries()) {
    for (const id of set) {
      totalIds.add(id);
      const existing = idSources.get(id) ?? [];
      existing.push(key);
      idSources.set(id, existing);
    }
  }

  if (!totalIds.size) {
    const fallbackIds = contents.match(/\b\d{5,12}\b/g) ?? [];
    fallbackIds.forEach((id) => {
      totalIds.add(id);
      idSources.set(id, ["unknown"]);
    });
  }

  return { totalIds, idSources };
}

async function upsertRows(rows: SeedRow[]) {
  if (!rows.length) return;
  const sb = supabaseAdmin();
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await sb.from("roblox_music_ids").upsert(chunk, {
      onConflict: "asset_id",
      ignoreDuplicates: !UPDATE_EXISTING
    });
    if (error) {
      throw new Error(`Failed to upsert seed IDs: ${error.message}`);
    }
    console.log(`Upserted ${Math.min(i + UPSERT_CHUNK, rows.length)} / ${rows.length} seed IDs...`);
  }
}

async function run() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set.");
  }

  const contents = await readFile(SEED_FILE, "utf8");
  const { totalIds, idSources } = parseSeedFile(contents);
  const now = new Date().toISOString();

  const rows: SeedRow[] = Array.from(totalIds).map((id) => {
    const sources = idSources.get(id) ?? ["unknown"];
    return {
      asset_id: Number(id),
      title: SEED_TITLE,
      artist: SEED_ARTIST,
      album: null,
      genre: null,
      duration_seconds: null,
      album_art_asset_id: null,
      source: SEED_SOURCE,
      raw_payload: {
        seed_sources: sources,
        seed_file: SEED_FILE,
        seed_imported_at: now
      },
      last_seen_at: now
    };
  });

  console.log(`Importing ${rows.length} seed IDs from ${SEED_FILE}...`);
  await upsertRows(rows);
  console.log("Done.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
