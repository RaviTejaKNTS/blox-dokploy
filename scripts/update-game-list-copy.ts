import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase";

type UpdateRow = {
  id: string;
  intro_md: string | null;
  outro_md: string | null;
  meta_description: string | null;
};

type CliOptions = {
  file: string;
  dryRun: boolean;
  limit: number | null;
};

const DEFAULT_FILE = "game_lists_rows_with_copy_expanded (1).csv";

function printUsage() {
  console.log("Usage: tsx scripts/update-game-list-copy.ts [--file path] [--dry-run] [--limit N]");
  console.log(`Defaults: --file "${DEFAULT_FILE}"`);
}

function parseArgs(argv: string[]): CliOptions {
  let file = DEFAULT_FILE;
  let dryRun = false;
  let limit: number | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--file") {
      const next = argv[i + 1];
      if (next) {
        file = next;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("--file=")) {
      file = arg.slice("--file=".length);
      continue;
    }
    if (arg === "--limit") {
      const next = argv[i + 1];
      if (next && !Number.isNaN(Number(next))) {
        limit = Number(next);
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isNaN(value)) {
        limit = value;
      }
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { file, dryRun, limit };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function normalizeText(value: string | undefined): string | null {
  if (value == null) return null;
  const normalized = value.replace(/\r\n/g, "\n");
  if (normalized.trim().length === 0) return null;
  return normalized;
}

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inQuotes) {
      if (char === "\"") {
        const next = raw[i + 1];
        if (next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    if (char === "\r") {
      if (raw[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return row[index] ?? "";
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment.");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), options.file);
  const raw = await fs.readFile(filePath, "utf8");
  const rows = parseCsv(raw);

  if (rows.length === 0) {
    console.error("No CSV rows found.");
    process.exit(1);
  }

  const headers = rows.shift() ?? [];
  const headerIndex = new Map<string, number>();
  headers.forEach((header, idx) => {
    headerIndex.set(normalizeHeader(header), idx);
  });

  const requiredHeaders = ["id", "intro_md", "outro_md", "meta_description"];
  const missingHeaders = requiredHeaders.filter((key) => !headerIndex.has(key));
  if (missingHeaders.length) {
    console.error(`Missing required headers: ${missingHeaders.join(", ")}`);
    process.exit(1);
  }

  const updates = new Map<string, UpdateRow>();
  let skipped = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    const id = cell(row, headerIndex.get("id")!).trim();
    if (!id) {
      skipped += 1;
      continue;
    }

    const record: UpdateRow = {
      id,
      intro_md: normalizeText(cell(row, headerIndex.get("intro_md")!)),
      outro_md: normalizeText(cell(row, headerIndex.get("outro_md")!)),
      meta_description: normalizeText(cell(row, headerIndex.get("meta_description")!))
    };

    if (updates.has(id)) {
      duplicateCount += 1;
    }
    updates.set(id, record);
  }

  let payload = Array.from(updates.values());
  if (options.limit != null) {
    payload = payload.slice(0, options.limit);
  }

  console.log(`Loaded ${payload.length} updates from ${path.relative(process.cwd(), filePath)}.`);
  if (duplicateCount) {
    console.warn(`Detected ${duplicateCount} duplicate id(s); last row wins.`);
  }
  if (skipped) {
    console.warn(`Skipped ${skipped} row(s) without an id.`);
  }

  if (payload.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  if (options.dryRun) {
    console.log("Dry run: no database updates were made.");
    console.log("Sample payload:", payload[0]);
    return;
  }

  const supabase = supabaseAdmin();
  const batchSize = 10;
  const batches = chunk(payload, batchSize);

  let updated = 0;
  const missingIds: string[] = [];
  const failures: { id: string; message: string }[] = [];

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const results = await Promise.all(
      batch.map(async (row) => {
        const { data, error } = await supabase
          .from("game_lists")
          .update({
            intro_md: row.intro_md,
            outro_md: row.outro_md,
            meta_description: row.meta_description
          })
          .eq("id", row.id)
          .select("id");

        if (error) {
          return { id: row.id, status: "error" as const, message: error.message };
        }

        if (!data || data.length === 0) {
          return { id: row.id, status: "missing" as const };
        }

        return { id: row.id, status: "updated" as const };
      })
    );

    for (const result of results) {
      if (result.status === "updated") {
        updated += 1;
      } else if (result.status === "missing") {
        missingIds.push(result.id);
      } else {
        failures.push({ id: result.id, message: result.message });
      }
    }

    const processed = Math.min((i + 1) * batchSize, payload.length);
    console.log(
      `Processed ${processed}/${payload.length} (updated ${updated}, missing ${missingIds.length}, failed ${failures.length}).`
    );
  }

  if (missingIds.length) {
    const preview = missingIds.slice(0, 20).join(", ");
    console.warn(`Missing ids (first ${Math.min(20, missingIds.length)}): ${preview}`);
  }

  if (failures.length) {
    const preview = failures.slice(0, 10).map((item) => `${item.id}: ${item.message}`).join(" | ");
    console.warn(`Failures (first ${Math.min(10, failures.length)}): ${preview}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
