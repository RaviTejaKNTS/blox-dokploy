import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";
import { appendCodesSuffix, normalizeGameSlug, stripCodesSuffix } from "@/lib/slug";

const PAGE_SIZE = Number(process.env.GAME_SLUG_SYNC_BATCH ?? "500");
const UPDATE_BATCH = 100;

type GameRow = {
  id: string;
  slug: string;
  name: string | null;
  universe_id: number | null;
  universe: {
    slug: string | null;
  } | null;
};

const supabase = supabaseAdmin();

function computeDesiredSlug(game: GameRow): string | null {
  if (game.universe_id && game.universe?.slug) {
    return appendCodesSuffix(game.universe.slug);
  }
  const base =
    game.name?.trim() ||
    stripCodesSuffix(game.slug ?? "") ||
    game.slug ||
    "";
  if (!base) return null;
  return normalizeGameSlug(base, base);
}

async function fetchGames(offset: number) {
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, name, universe_id, universe:roblox_universes(slug)")
    .order("updated_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error(`Failed to fetch games: ${error.message}`);
  const rows = (data ?? []) as Array<
    Omit<GameRow, "universe"> & { universe: Array<{ slug: string | null }> | null }
  >;
  return rows.map((row) => ({
    ...row,
    universe: Array.isArray(row.universe) ? row.universe[0] ?? null : (row.universe as GameRow["universe"]),
  }));
}

async function applyUpdates(updates: Array<{ id: string; slug: string }>) {
  for (let start = 0; start < updates.length; start += UPDATE_BATCH) {
    const slice = updates.slice(start, start + UPDATE_BATCH);
    const responses = await Promise.all(
      slice.map((payload) =>
        supabase.from("games").update({ slug: payload.slug }).eq("id", payload.id),
      ),
    );
    for (const response of responses) {
      if (response.error) {
        throw new Error(`Failed to update game slug: ${response.error.message}`);
      }
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let offset = 0;
  let processed = 0;
  const pending: Array<{ id: string; slug: string }> = [];

  while (true) {
    const games = await fetchGames(offset);
    if (!games.length) break;
    for (const game of games) {
      processed += 1;
      const desiredSlug = computeDesiredSlug(game);
      if (!desiredSlug || desiredSlug === game.slug) continue;
      pending.push({ id: game.id, slug: desiredSlug });
      console.log(`→ ${game.slug} → ${desiredSlug} (game ${game.id}${game.universe_id ? ` · universe ${game.universe_id}` : ""})`);
    }
    if (games.length < PAGE_SIZE) break;
    offset += games.length;
  }

  console.log(`\nIdentified ${pending.length} slug updates across ${processed} games (${dryRun ? "dry run" : "mutating"}).`);
  if (!pending.length) return;

  if (dryRun) {
    console.log("Dry run complete. No database changes were made.");
    return;
  }

  await applyUpdates(pending);
  console.log("✅ Game slugs synchronized.");
}

main().catch((error) => {
  console.error("Slug sync failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
