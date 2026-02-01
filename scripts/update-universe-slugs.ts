import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify, stripCodesSuffix } from "@/lib/slug";

const PAGE_SIZE = Number(process.env.UNIVERSE_SLUG_BATCH ?? "500");
const UPDATE_BATCH = 50;

type GameWithUniverse = {
  id: string;
  slug: string;
  universe_id: number;
  universe: {
    slug: string | null;
  } | null;
};

function isDryRun() {
  return process.argv.includes("--dry-run");
}

function cleanUniverseSlug(slug: string): string | null {
  const withoutSuffix = stripCodesSuffix(slug);
  const normalized = slugify(withoutSuffix);
  return normalized || null;
}

const supabase = supabaseAdmin();

async function fetchGamesWithUniverses(offset: number) {
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, universe_id, universe:roblox_universes(slug)")
    .not("universe_id", "is", null)
    .order("updated_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error(`Failed to load games: ${error.message}`);
  const rows = (data ?? []) as Array<
    Omit<GameWithUniverse, "universe"> & { universe: Array<{ slug: string | null }> | null }
  >;
  return rows.map((row) => ({
    ...row,
    universe: Array.isArray(row.universe) ? row.universe[0] ?? null : (row.universe as GameWithUniverse["universe"]),
  }));
}

async function applyUpdates(updates: Array<{ universe_id: number; slug: string }>) {
  if (!updates.length) return;
  for (let start = 0; start < updates.length; start += UPDATE_BATCH) {
    const slice = updates.slice(start, start + UPDATE_BATCH);
    const responses = await Promise.all(
      slice.map((payload) =>
        supabase
          .from("roblox_universes")
          .update({ slug: payload.slug })
          .eq("universe_id", payload.universe_id),
      ),
    );
    for (const response of responses) {
      if (response.error) {
        throw new Error(`Failed to update universe slug: ${response.error.message}`);
      }
    }
  }
}

async function main() {
  const dryRun = isDryRun();
  const updatesMap = new Map<number, { slug: string; gameSlug: string }>();
  let offset = 0;
  let processed = 0;

  while (true) {
    const rows = await fetchGamesWithUniverses(offset);
    if (!rows.length) break;

    for (const row of rows) {
      processed += 1;
      if (!row.universe_id || !row.slug) continue;
      const nextSlug = cleanUniverseSlug(row.slug);
      if (!nextSlug) continue;

      const currentSlug = row.universe?.slug ?? null;
      if (currentSlug === nextSlug) continue;

      if (!updatesMap.has(row.universe_id)) {
        updatesMap.set(row.universe_id, { slug: nextSlug, gameSlug: row.slug });
        console.log(
          `→ Universe ${row.universe_id}: "${currentSlug ?? "<empty>"}" -> "${nextSlug}" (from game ${row.slug})`
        );
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += rows.length;
  }

  const updates = Array.from(updatesMap.entries()).map(([universe_id, payload]) => ({
    universe_id,
    slug: payload.slug
  }));

  console.log(
    `\nFound ${updates.length} universe slug updates out of ${processed} games (${dryRun ? "dry run" : "mutating"})`
  );

  if (!dryRun && updates.length) {
    await applyUpdates(updates);
    console.log("✅ Universe slugs updated.");
  } else if (dryRun) {
    console.log("Dry run complete. No changes were written.");
  } else {
    console.log("Nothing to update.");
  }
}

main().catch((err) => {
  console.error("Script failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
