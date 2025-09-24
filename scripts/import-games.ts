import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase";
import { scrapeSources } from "@/lib/scraper";

export type ImportPayload = {
  sourceUrl: string;
  sourceUrl2?: string | null;
  sourceUrl3?: string | null;
  name?: string;
  slug?: string;
  publish?: boolean;
};

type ImportResult = {
  slug: string;
  name: string;
  publish: boolean;
  codesFound: number;
  codesUpserted: number;
};

type ParsedEntries = {
  entries: ImportPayload[];
  errors: string[];
};

function printUsage() {
  console.log(`\nUsage: npx tsx scripts/import-games.ts [options] [<sourceUrl> ...]\n\nOptions:\n  -s, --source <url>            Provide the primary source URL (can repeat).\n      --source2 <url>          Optional secondary source URL for the most recent entry.\n      --source3 <url>          Optional tertiary source URL for the most recent entry.\n  -n, --name <value>            Optional title to use for the most recent source.\n      --slug <value>            Optional slug to use for the most recent source.\n      --publish <bool>          Override publish flag for the most recent source or default when none pending.\n      --draft, --no-publish     Mark the most recent source (or default) as unpublished.\n      --default-publish <bool>  Set the default publish flag for entries without an explicit value.\n      --default-draft           Shortcut for --default-publish false.\n      --file <path>             Load entries from a JSON file (array or single object/string).\n  -h, --help                    Show this help message.\n\nExamples:\n  npx tsx scripts/import-games.ts https://www.robloxden.com/codes/some-game\n  npx tsx scripts/import-games.ts -s https://... -n "My Game" --draft\n  npx tsx scripts/import-games.ts --file ./games.json\n`);
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function slugFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.pop() || null;
  } catch {
    return null;
  }
}

function titleCase(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeEntry(entry: unknown): ImportPayload {
  if (typeof entry === "string") {
    return { sourceUrl: entry };
  }
  if (entry && typeof entry === "object" && "sourceUrl" in entry) {
    const value = entry as Record<string, unknown>;
    if (typeof value.sourceUrl === "string" && value.sourceUrl.trim()) {
      const payload: ImportPayload = { sourceUrl: value.sourceUrl };
      if (typeof value.sourceUrl2 === "string") payload.sourceUrl2 = value.sourceUrl2;
      if (typeof value.sourceUrl3 === "string") payload.sourceUrl3 = value.sourceUrl3;
      if (typeof value.name === "string" && value.name.trim()) payload.name = value.name;
      if (typeof value.slug === "string" && value.slug.trim()) payload.slug = value.slug;
      if (typeof value.publish === "boolean") payload.publish = value.publish;
      return payload;
    }
  }
  throw new Error("Invalid entry: sourceUrl required");
}

async function readEntriesFromFile(filePath: string): Promise<ImportPayload[]> {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map(normalizeEntry);
}

async function collectEntries(argv: string[]): Promise<ParsedEntries> {
  const entries: ImportPayload[] = [];
  const filePaths: string[] = [];
  const errors: string[] = [];
  let pending: Partial<ImportPayload> | null = null;
  let defaultPublish = true;

  const finalizePending = () => {
    if (!pending) return;
    if (!pending.sourceUrl) {
      errors.push("Encountered options without a preceding source URL.");
    } else {
      const entry: ImportPayload = {
        sourceUrl: pending.sourceUrl,
        ...(pending.sourceUrl2 !== undefined ? { sourceUrl2: pending.sourceUrl2 } : {}),
        ...(pending.sourceUrl3 !== undefined ? { sourceUrl3: pending.sourceUrl3 } : {}),
        name: pending.name,
        slug: pending.slug,
        publish: pending.publish ?? defaultPublish,
      };
      entries.push(entry);
    }
    pending = null;
  };

  const requireValue = (value: string | undefined, flag: string) => {
    if (!value) throw new Error(`Missing value for ${flag}`);
    return value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      case "--source":
      case "-s": {
        finalizePending();
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        pending = { sourceUrl: value, publish: defaultPublish };
        break;
      }
      case "--name":
      case "-n": {
        if (!pending) {
          throw new Error(`${arg} must come after a source.`);
        }
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        pending.name = value;
        break;
      }
      case "--source2":
      case "--source3": {
        if (!pending) {
          throw new Error(`${arg} must come after a source.`);
        }
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        const key = arg === "--source2" ? "sourceUrl2" : "sourceUrl3";
        (pending as any)[key] = value;
        break;
      }
      case "--slug": {
        if (!pending) {
          throw new Error(`${arg} must come after a source.`);
        }
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        pending.slug = value;
        break;
      }
      case "--publish": {
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        const bool = parseBoolean(value);
        if (pending) {
          pending.publish = bool;
        } else {
          defaultPublish = bool;
        }
        break;
      }
      case "--draft":
      case "--no-publish": {
        if (pending) {
          pending.publish = false;
        } else {
          defaultPublish = false;
        }
        break;
      }
      case "--default-publish": {
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        defaultPublish = parseBoolean(value);
        break;
      }
      case "--default-draft": {
        defaultPublish = false;
        break;
      }
      case "--file":
      case "--json": {
        finalizePending();
        const value = requireValue(argv[i + 1], arg);
        i += 1;
        filePaths.push(value);
        break;
      }
      default: {
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        finalizePending();
        pending = { sourceUrl: arg, publish: defaultPublish };
        break;
      }
    }
  }

  finalizePending();

  for (const filePath of filePaths) {
    try {
      const fromFile = await readEntriesFromFile(filePath);
      for (const payload of fromFile) {
        entries.push({
          sourceUrl: payload.sourceUrl,
          ...(payload.sourceUrl2 !== undefined ? { sourceUrl2: payload.sourceUrl2 } : {}),
          ...(payload.sourceUrl3 !== undefined ? { sourceUrl3: payload.sourceUrl3 } : {}),
          name: payload.name,
          slug: payload.slug,
          publish: payload.publish ?? defaultPublish,
        });
      }
    } catch (err: any) {
      errors.push(`Failed to load ${filePath}: ${err?.message ?? err}`);
    }
  }

  return { entries, errors };
}

function ensureCodesSuffix(slug: string): string {
  const suffix = 'codes';
  const normalizedSlug = slug.toLowerCase().trim();
  if (!normalizedSlug.endsWith(suffix)) {
    return `${slug}-${suffix}`.replace(/--+/g, '-');
  }
  return slug;
}

async function importSingleGame(
  sb: ReturnType<typeof supabaseAdmin>,
  payload: ImportPayload,
): Promise<ImportResult> {
  const { sourceUrl, sourceUrl2, sourceUrl3, name, slug, publish } = payload;
  if (!sourceUrl) throw new Error("sourceUrl required");

  let derivedSlug = slug ?? slugFromUrl(sourceUrl);
  if (!derivedSlug) throw new Error("Could not derive slug from source URL");
  
  // Ensure slug ends with 'codes'
  derivedSlug = ensureCodesSuffix(derivedSlug);

  const derivedName = name ?? titleCase(derivedSlug.replace(/-codes$/, ''));
  const publishFlag = publish ?? true;

  const normalizeOptionalUrl = (value: string | null | undefined) => {
    if (value === null || value === undefined) return value ?? null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const upsertPayload: Record<string, any> = {
    name: derivedName,
    slug: derivedSlug,
    source_url: sourceUrl,
    is_published: publishFlag,
  };

  if (sourceUrl2 !== undefined) {
    upsertPayload.source_url_2 = normalizeOptionalUrl(sourceUrl2);
  }
  if (sourceUrl3 !== undefined) {
    upsertPayload.source_url_3 = normalizeOptionalUrl(sourceUrl3);
  }

  const { data: game, error: upsertError } = await sb
    .from("games")
    .upsert(upsertPayload, { onConflict: "slug" })
    .select("*")
    .single();

  if (upsertError || !game) {
    throw new Error(upsertError?.message ?? "Upsert failed");
  }

  const sourceCandidates = [
    game.source_url,
    (game as any).source_url_2,
    (game as any).source_url_3,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  const { codes, expiredCodes } = await scrapeSources(sourceCandidates);
  let upserted = 0;

  for (const c of codes) {
    const { error: rpcError } = await sb.rpc("upsert_code", {
      p_game_id: game.id,
      p_code: c.code,
      p_status: c.status,
      p_rewards_text: c.rewardsText ?? null,
      p_level_requirement: c.levelRequirement ?? null,
      p_is_new: c.isNew ?? false,
    });

    if (rpcError) {
      throw new Error(`Upsert failed for ${c.code}: ${rpcError.message}`);
    }

    upserted += 1;
  }

  await sb
    .from("games")
    .update({ expired_codes: expiredCodes })
    .eq("id", game.id);

  await sb
    .from("codes")
    .delete()
    .eq("game_id", game.id)
    .eq("status", "expired");

  return {
    slug: game.slug,
    name: game.name,
    publish: Boolean(game.is_published),
    codesFound: codes.length,
    codesUpserted: upserted,
  };
}

async function main() {
  try {
    const argv = process.argv.slice(2);
    const { entries, errors } = await collectEntries(argv);

    if (errors.length) {
      for (const err of errors) {
        console.error(`⚠️  ${err}`);
      }
    }

    if (!entries.length) {
      console.error("No entries to import.");
      printUsage();
      process.exitCode = 1;
      return;
    }

    const sb = supabaseAdmin();
    console.log(`\n▶ Importing ${entries.length} game(s)`);

    const stats = {
      processed: 0,
      success: 0,
      failed: 0,
      totalCodesFound: 0,
      totalCodesUpserted: 0,
    };

    for (const entry of entries) {
      stats.processed += 1;
      try {
        const result = await importSingleGame(sb, entry);
        stats.success += 1;
        stats.totalCodesFound += result.codesFound;
        stats.totalCodesUpserted += result.codesUpserted;
        console.log(
          `✔ ${result.slug} (${result.publish ? "published" : "draft"}) — ${result.codesUpserted} codes upserted (found ${result.codesFound})`,
        );
      } catch (err: any) {
        stats.failed += 1;
        console.error(`✖ ${entry.sourceUrl} — ${err?.message ?? err}`);
      }
    }

    console.log("\n▶ Import summary");
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Succeeded: ${stats.success}`);
    console.log(`   Failed:    ${stats.failed}`);
    console.log(`   Codes found:    ${stats.totalCodesFound}`);
    console.log(`   Codes upserted: ${stats.totalCodesUpserted}`);

    if (stats.failed > 0 || errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("Fatal import error", err);
    process.exitCode = 1;
  }
}

main();
