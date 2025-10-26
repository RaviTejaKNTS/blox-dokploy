import "dotenv/config";

import { supabaseAdmin } from "@/lib/supabase";
import { generateLinktextForGames } from "@/lib/linktext";

type CliOptions = {
  slugs: string[];
  overwrite: boolean;
  dryRun: boolean;
  limit?: number;
  minLinks?: number;
};

function printUsage() {
  console.log(`Usage: npm run linktext:generate -- [options]

Options:
  --slug <slug>        Only update the specified slug (can repeat).
  --overwrite          Replace existing linktext_md instead of skipping.
  --dry-run            Show the generated copy without writing to Supabase.
  --limit <number>     Stop after updating this many games.
  --min-links <number> Require this many recommendations (default 3).
  -h, --help           Show this help message.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const slugs: string[] = [];
  let overwrite = false;
  let dryRun = false;
  let limit: number | undefined;
  let minLinks: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--slug":
      case "-s": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value after --slug");
        slugs.push(value.trim());
        i += 1;
        break;
      }
      case "--overwrite":
        overwrite = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--limit": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value after --limit");
        limit = Number(value);
        if (!Number.isFinite(limit) || limit <= 0) {
          throw new Error("Invalid --limit value");
        }
        i += 1;
        break;
      }
      case "--min-links": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value after --min-links");
        minLinks = Math.max(3, Number(value));
        if (!Number.isFinite(minLinks)) {
          throw new Error("Invalid --min-links value");
        }
        i += 1;
        break;
      }
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--slug=")) {
          slugs.push(arg.slice("--slug=".length).trim());
        } else {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  return { slugs, overwrite, dryRun, limit, minLinks };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = supabaseAdmin();
  await generateLinktextForGames(supabase, {
    slugs: options.slugs,
    overwrite: options.overwrite,
    dryRun: options.dryRun,
    limit: options.limit,
    minLinks: options.minLinks,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
