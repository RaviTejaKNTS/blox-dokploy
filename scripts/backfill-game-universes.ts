import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";
import { ensureUniverseForRobloxLink } from "@/lib/roblox/universe";

const PAGE_SIZE = Number(process.env.ROBLOX_BACKFILL_PAGE_SIZE ?? "200");

type GameRow = {
  id: string;
  name: string;
  slug: string;
  roblox_link: string | null;
  universe_id: number | null;
};

type CategoryRow = { id: string };

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { all: boolean } = { all: false };
  for (const arg of args) {
    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npx tsx scripts/backfill-game-universes.ts [--all]

Options:
  --all     Reprocess all games even if universe_id is already set.
`);
      process.exit(0);
    } else {
      console.warn(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function updateCategoriesAndArticles(
  supabase = supabaseAdmin(),
  gameId: string,
  universeId: number
) {
  const { data: categories, error: categoryError } = await supabase
    .from("article_categories")
    .select("id")
    .eq("game_id", gameId);
  if (categoryError) {
    throw new Error(`Failed to load categories for game ${gameId}: ${categoryError.message}`);
  }

  await supabase
    .from("article_categories")
    .update({ universe_id: universeId })
    .eq("game_id", gameId);

  const categoryIds = (categories as CategoryRow[] | null)?.map((row) => row.id) ?? [];
  if (categoryIds.length) {
    await supabase
      .from("articles")
      .update({ universe_id: universeId })
      .in("category_id", categoryIds);
  }
}

async function processGames() {
  const options = parseArgs();
  const supabase = supabaseAdmin();
  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    let query = supabase
      .from("games")
      .select("id, name, slug, roblox_link, universe_id")
      .order("updated_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!options.all) {
      query = query.is("universe_id", null);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load games: ${error.message}`);
    }

    const games = (data as GameRow[] | null) ?? [];
    if (!games.length) {
      break;
    }

    for (const game of games) {
      totalProcessed += 1;
      if (!game.roblox_link) {
        console.log(`⚠️ Skipping ${game.slug} (no roblox_link)`);
        continue;
      }

      try {
        const ensured = await ensureUniverseForRobloxLink(supabase, game.roblox_link);
        if (!ensured.universeId) {
          console.log(`⚠️ Unable to resolve universe for ${game.slug}`);
          continue;
        }

        if (!options.all && game.universe_id === ensured.universeId) {
          continue;
        }

        const { error: updateError } = await supabase
          .from("games")
          .update({ universe_id: ensured.universeId })
          .eq("id", game.id);
        if (updateError) {
          throw new Error(updateError.message);
        }

        await updateCategoriesAndArticles(supabase, game.id, ensured.universeId);

        totalUpdated += 1;
        console.log(`✅ ${game.slug} → universe ${ensured.universeId}`);
      } catch (err) {
        console.error(
          `❌ Failed to backfill ${game.slug}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    offset += games.length;
    if (games.length < PAGE_SIZE) {
      break;
    }
  }

  console.log(`\nBackfill complete. Processed ${totalProcessed}, updated ${totalUpdated}.`);
}

processGames().catch((error) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
