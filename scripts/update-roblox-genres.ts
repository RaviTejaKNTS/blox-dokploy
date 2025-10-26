import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";
import {
  extractPlaceId,
  fetchGenreFromApi,
  fetchGenreFromUniverse,
  scrapeRobloxGameMetadata
} from "@/lib/roblox/game-metadata";

type GameRecord = {
  id: string;
  name: string;
  slug: string | null;
  roblox_link: string | null;
  community_link: string | null;
  genre: string | null;
  sub_genre: string | null;
};

type ScriptResult = {
  slug: string | null;
  name: string;
  status: "updated" | "skipped" | "error";
  genre?: string | null;
  subGenre?: string | null;
  communityLink?: string | null;
  communityLinkAdded?: boolean;
  error?: string;
};

async function updateGameGenre(sb: ReturnType<typeof supabaseAdmin>, game: GameRecord): Promise<ScriptResult> {
  const slug = game.slug ?? game.id;
  if (!game.roblox_link) {
    return { slug: game.slug, name: game.name, status: "skipped" };
  }

  try {
    const scraped = await scrapeRobloxGameMetadata(game.roblox_link);
    let genre = scraped.genre;
    let subGenre = scraped.subGenre;
    const communityLink = scraped.communityLink;

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
    if (!game.community_link && communityLink) {
      updates.community_link = communityLink;
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
      subGenre: updates.sub_genre ?? game.sub_genre,
      communityLink: updates.community_link,
      communityLinkAdded: Boolean(updates.community_link)
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
    .select("id, name, slug, roblox_link, community_link, genre, sub_genre")
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
      const updates: string[] = [
        `Genre: ${result.genre ?? "unchanged"}`,
        `Sub-genre: ${result.subGenre ?? "unchanged"}`
      ];
      if (result.communityLinkAdded && result.communityLink) {
        updates.push(`Community link set (${result.communityLink})`);
      }
      console.log(`✓ ${game.name} → ${updates.join(", ")}`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
