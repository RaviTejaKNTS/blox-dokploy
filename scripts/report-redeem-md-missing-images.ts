import "dotenv/config";

import { promises as fs } from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_PAGE_SIZE = Number(process.env.REDEEM_MD_PAGE_SIZE ?? "500");
const DEFAULT_OUTPUT_PATH = process.env.REDEEM_MD_OUTPUT ?? "redeem-md-missing-images.md";

type CliOptions = {
  outputPath: string;
  pageSize: number;
  limit: number | null;
  publishedOnly: boolean;
};

type GameRow = {
  id: string;
  slug: string;
  redeem_md: string | null;
};

const IMAGE_PATTERN = /!\[[^\]]*]\([^)]+\)|!\[[^\]]*]\[[^\]]*]|<img\b|<picture\b|<source\b/i;

function hasImage(markdown: string | null): boolean {
  if (!markdown) return false;
  const trimmed = markdown.trim();
  if (!trimmed) return false;
  return IMAGE_PATTERN.test(trimmed);
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(argv: string[]): CliOptions {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let pageSize = DEFAULT_PAGE_SIZE;
  let limit: number | null = null;
  let publishedOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --output");
      }
      outputPath = next;
      i += 1;
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    } else if (arg === "--page-size") {
      const value = parseNumber(argv[i + 1]);
      if (value == null) {
        throw new Error("Missing or invalid value for --page-size");
      }
      pageSize = value;
      i += 1;
    } else if (arg.startsWith("--page-size=")) {
      const value = parseNumber(arg.split("=")[1]);
      if (value == null) {
        throw new Error("Invalid value for --page-size");
      }
      pageSize = value;
    } else if (arg === "--limit") {
      const value = parseNumber(argv[i + 1]);
      if (value == null) {
        throw new Error("Missing or invalid value for --limit");
      }
      limit = value;
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      const value = parseNumber(arg.split("=")[1]);
      if (value == null) {
        throw new Error("Invalid value for --limit");
      }
      limit = value;
    } else if (arg === "--published") {
      publishedOnly = true;
    }
  }

  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive number");
  }
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error("Limit must be a positive number");
  }

  return { outputPath, pageSize, limit, publishedOnly };
}

async function fetchGames(
  supabase: ReturnType<typeof supabaseAdmin>,
  offset: number,
  pageSize: number,
  publishedOnly: boolean
): Promise<GameRow[]> {
  let query = supabase
    .from("games")
    .select("id, slug, redeem_md")
    .order("slug", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (publishedOnly) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch games: ${error.message}`);
  }

  return (data ?? []) as GameRow[];
}

async function main() {
  const { outputPath, pageSize, limit, publishedOnly } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
    process.exit(1);
  }

  const supabase = supabaseAdmin();

  let offset = 0;
  let processed = 0;
  const missing: string[] = [];
  let remaining = limit ?? Number.POSITIVE_INFINITY;

  while (remaining > 0) {
    const batchSize = Math.min(pageSize, remaining);
    const rows = await fetchGames(supabase, offset, batchSize, publishedOnly);
    if (!rows.length) break;

    for (const row of rows) {
      processed += 1;
      if (!hasImage(row.redeem_md)) {
        missing.push(row.slug);
      }
    }

    remaining -= rows.length;
    if (rows.length < batchSize) break;
    offset += rows.length;
  }

  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const dir = path.dirname(resolvedPath);
  if (dir && dir !== ".") {
    await fs.mkdir(dir, { recursive: true });
  }

  const lines = [
    "# Redeem markdown without images",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Total games scanned: ${processed}`,
    `Games missing images: ${missing.length}`,
    "",
    ...missing.map((slug) => `- ${slug}`)
  ];

  await fs.writeFile(resolvedPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${missing.length} slugs to ${resolvedPath}`);
}

main().catch((error) => {
  console.error("Redeem markdown scan failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
