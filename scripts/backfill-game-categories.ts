import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";
import { ensureCategoryForGame } from "@/lib/admin/categories";
import { categorySlugFromGame } from "@/lib/slug";

type GameRecord = {
  id: string;
  name: string | null;
  slug: string | null;
};

async function main() {
  const sb = supabaseAdmin();

  const { data: games, error } = await sb
    .from("games")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load games:", error.message);
    process.exit(1);
  }

  const list = (games ?? []) as GameRecord[];
  if (!list.length) {
    console.warn("No games found. Nothing to backfill.");
    process.exit(0);
  }

  let ensuredCount = 0;
  let renamedCount = 0;
  let missingSlugCount = 0;

  for (const game of list) {
    const expectedSlug = categorySlugFromGame({ name: game.name, slug: game.slug });
    if (!expectedSlug) {
      missingSlugCount += 1;
      console.warn(`⚠️  Skipping ${game.name ?? game.id}: unable to derive category slug.`);
      continue;
    }

    const { slug, previousSlug } = await ensureCategoryForGame(sb, {
      id: game.id,
      name: game.name ?? expectedSlug,
      slug: game.slug ?? expectedSlug
    });

    ensuredCount += 1;
    if (previousSlug && previousSlug !== slug) {
      renamedCount += 1;
      console.log(`↻ Updated category slug for ${game.name ?? game.id}: ${previousSlug} → ${slug}`);
    } else {
      console.log(`✓ Ensured category for ${game.name ?? game.id}: ${slug}`);
    }
  }

  console.log("\nBackfill complete");
  console.log(`  Categories ensured: ${ensuredCount}`);
  console.log(`  Slug updates:      ${renamedCount}`);
  console.log(`  Missing slugs:     ${missingSlugCount}`);
}

main().catch((error) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
