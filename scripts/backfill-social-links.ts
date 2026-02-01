import "dotenv/config";

import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  SOCIAL_LINK_FIELDS,
  type SocialLinkType,
  type SocialLinkDetail,
  scrapeSocialLinksFromSources
} from "@/lib/social-links";

type GameRow = {
  id: string;
  name: string;
  slug: string;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  roblox_link: string | null;
  community_link: string | null;
  discord_link: string | null;
  twitter_link: string | null;
  youtube_link: string | null;
};

type LinkColumn = keyof Pick<GameRow, "roblox_link" | "community_link" | "discord_link" | "twitter_link" | "youtube_link">;

const TYPE_TO_COLUMN: Record<SocialLinkType, LinkColumn> = {
  roblox: "roblox_link",
  community: "community_link",
  discord: "discord_link",
  twitter: "twitter_link",
  youtube: "youtube_link"
};

type SupabaseClient = ReturnType<typeof supabaseAdmin>;

type GameUpdateResult = {
  game: GameRow;
  updatedFields: Array<{ column: LinkColumn; value: string; detail: SocialLinkDetail }>;
  skipped: boolean;
  reason?: string;
  errors: string[];
};

type CliOptions = {
  slug?: string;
  sources: string[];
};

function formatDetail(detail: SocialLinkDetail): string {
  return `${detail.provider} (${detail.sourceUrl})`;
}

function collectSourceUrls(game: GameRow): string[] {
  return [game.source_url, game.source_url_2, game.source_url_3]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

async function processGame(game: GameRow, supabase: SupabaseClient, sourceOverride?: string[]) {
  const missingTypes = SOCIAL_LINK_FIELDS.filter((type) => {
    const column = TYPE_TO_COLUMN[type];
    return !game[column];
  });

  if (missingTypes.length === 0) {
    return { game, updatedFields: [], skipped: true, reason: "all links present", errors: [] } as GameUpdateResult;
  }

  const sources =
    sourceOverride && sourceOverride.length > 0 ? sourceOverride : collectSourceUrls(game);
  if (sources.length === 0) {
    return { game, updatedFields: [], skipped: true, reason: "no sources configured", errors: [] } as GameUpdateResult;
  }

  const { links, details, errors } = await scrapeSocialLinksFromSources(sources);

  const updates: Partial<Record<LinkColumn, string>> = {};
  const appliedDetails: Array<{ column: LinkColumn; value: string; detail: SocialLinkDetail }> = [];

  for (const type of missingTypes) {
    const column = TYPE_TO_COLUMN[type];
    const linkValue = links[type];
    const linkDetail = details[type];
    if (linkValue && linkDetail) {
      updates[column] = linkValue;
      appliedDetails.push({ column, value: linkValue, detail: linkDetail });
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      game,
      updatedFields: [],
      skipped: true,
      reason: "no new links found",
      errors
    } as GameUpdateResult;
  }

  const { error } = await supabase
    .from("games")
    .update(updates)
    .eq("id", game.id);

  if (error) {
    throw error;
  }

  return { game, updatedFields: appliedDetails, skipped: false, errors } as GameUpdateResult;
}

function printUsage() {
  console.log(`Usage: npm run links:backfill -- [options]

Options:
  --slug <slug>        Process only the specified game slug.
  --source <url>       Provide a specific source URL (can repeat).
                       Without --slug, the script just previews the scraped links.
  -h, --help           Show this help message.
`);
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { sources: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--slug": {
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        options.slug = value.trim();
        break;
      }
      case "--source":
      case "--url": {
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        options.sources.push(value.trim());
        break;
      }
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        options.sources.push(arg.trim());
        break;
    }
  }
  return options;
}

async function previewSources(sources: string[]) {
  console.log(`Previewing ${sources.length} source(s)...`);
  const { links, details, errors } = await scrapeSocialLinksFromSources(sources);

  if (Object.keys(links).length === 0) {
    console.log("No social links detected.");
  } else {
    SOCIAL_LINK_FIELDS.forEach((type) => {
      const value = links[type];
      const detail = details[type];
      if (value && detail) {
        console.log(`  ${TYPE_TO_COLUMN[type]}: ${value} <- ${formatDetail(detail)}`);
      }
    });
  }

  for (const message of errors) {
    console.log(`  -> Source error: ${message}`);
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));

  if (!options.slug && options.sources.length > 0) {
    await previewSources(options.sources);
    return;
  }

  const supabase = supabaseAdmin();
  let query = supabase
    .from("games")
    .select(
      "id, name, slug, source_url, source_url_2, source_url_3, roblox_link, community_link, discord_link, twitter_link, youtube_link"
    )
    .order("updated_at", { ascending: false });

  if (options.slug) {
    query = query.eq("slug", options.slug);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const games = (data ?? []) as GameRow[];

  if (!games.length) {
    if (options.slug) {
      console.log(`No game found for slug "${options.slug}".`);
    } else {
      console.log("No games found.");
    }
    return;
  }

  const results: GameUpdateResult[] = [];
  const perFieldUpdates: Record<LinkColumn, number> = {
    roblox_link: 0,
    community_link: 0,
    discord_link: 0,
    twitter_link: 0,
    youtube_link: 0
  };

  const overrideSources = options.sources.length > 0 ? options.sources : undefined;

  for (const game of games) {
    try {
      const result = await processGame(game, supabase, overrideSources);
      results.push(result);
      for (const field of result.updatedFields) {
        perFieldUpdates[field.column] += 1;
      }

      if (result.updatedFields.length) {
        const applied = result.updatedFields
          .map((field) => `${field.column} <- ${formatDetail(field.detail)}`)
          .join(", ");
        console.log(`[ok] ${game.name} (${game.slug}): ${applied}`);
      } else if (!result.skipped) {
        console.log(`[warn] ${game.name} (${game.slug}): no applicable links after scraping.`);
      }

      for (const message of result.errors) {
        console.log(`   -> Source error: ${message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[error] Failed to update ${game.name} (${game.slug}): ${message}`);
      if ((err as PostgrestError)?.details) {
        console.error(`   Details: ${(err as PostgrestError).details}`);
      }
      break;
    }
  }

  const updatedGames = results.filter((result) => result.updatedFields.length > 0).length;
  const skipped = results.filter((result) => result.skipped).length;

  console.log("\nSummary");
  console.log("-------");
  console.log(`Games processed: ${results.length}`);
  console.log(`Games updated:   ${updatedGames}`);
  console.log(`Games skipped:   ${skipped}`);
  console.log("Fields updated:");
  (Object.keys(perFieldUpdates) as LinkColumn[]).forEach((column) => {
    console.log(`  ${column}: ${perFieldUpdates[column]}`);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
