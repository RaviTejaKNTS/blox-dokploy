import fs from "node:fs/promises";
import path from "node:path";

export type CropRecord = {
  name: string;
  imageUrl?: string | null;
  tier: string;
  // Average numbers (default)
  baseValue: number;
  baseWeightKg: number;
  // Baseline (price-floor) numbers
  baseValueFloor?: number | null;
  baseWeightFloorKg?: number | null;
  // Additional metadata
  minWeightKg?: number | null;
  hugeChancePercent?: number | null;
  stock?: string | null;
  obtainable?: boolean | null;
  eventType?: string | null;
};

export type CropDataset = {
  crops: CropRecord[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

const CROPS_MD_PATHS = [
  path.join(process.cwd(), "data", "Grow a Garden", "crops.md")
];

async function readCropsMarkdown(): Promise<string> {
  for (const candidate of CROPS_MD_PATHS) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  throw new Error(`Missing crops data file. Expected one of: ${CROPS_MD_PATHS.join(", ")}`);
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseWeight(value: string): number | null {
  return parseNumber(value.replace(/kg/i, "").trim());
}

function parsePercent(value: string): number | null {
  const num = parseNumber(value.replace(/%/g, ""));
  return num === null ? null : num;
}

function parseTableBlock(block: string): { rows: string[][]; heading: string | null } {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const tableStart = lines.findIndex((line) => line.startsWith("|"));
  if (tableStart === -1) return { rows: [], heading: null };

  const headingLine = lines[tableStart] ?? null;

  const rows: string[][] = [];
  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line?.startsWith("|")) break;
    const parts = line.split("|").slice(1, -1).map((part) => part.trim());
    if (parts.length > 1) {
      rows.push(parts);
    }
  }

  return { rows, heading: headingLine };
}

function dedupeByName(rows: CropRecord[]): CropRecord[] {
  const seen = new Map<string, CropRecord>();
  for (const row of rows) {
    if (!row.name) continue;
    if (!seen.has(row.name)) {
      seen.set(row.name, row);
      continue;
    }
    const existing = seen.get(row.name);
    if (existing && !existing.imageUrl && row.imageUrl) {
      seen.set(row.name, { ...existing, imageUrl: row.imageUrl });
    }
  }
  return Array.from(seen.values());
}

export async function loadCropDataset(): Promise<CropDataset> {
  const md = await readCropsMarkdown();

  const generatedMatch = md.match(/Generated:\s*([^\n]+)/i);
  const dataLastUpdatedOn = generatedMatch?.[1]?.trim() ?? null;

  const sourceMatch = md.match(/Source:\s*([^\n]+)/i);
  const source = sourceMatch?.[1]?.trim() ?? null;

  const sections = md.split(/^##\s+/gm).filter((section) => section.trim().length > 0);

  const crops: CropRecord[] = [];

  sections.forEach((section) => {
    // Only consider tables with crop info; skip the tier-only lists.
    if (!section.toLowerCase().includes("crops info")) return;

    const sectionTitle = section.split("\n")[0]?.trim() ?? null;
    const { rows } = parseTableBlock(section);
    if (!rows.length) return;

    const eventTypeMatch = sectionTitle?.match(/\(([^)]+)\)/);
    const eventType = eventTypeMatch?.[1] ?? null;

    rows.forEach((cells) => {
      // Expected columns (index-based):
      // Expected columns (index-based):
      // 0 name
      // 1 image (optional)
      // 1/2 Sheckle
      // 2/3 Sheckles Price
      // 3/4 Price-Floor Value (baseline)
      // 4/5 Average Value
      // 5/6 Price-Floor Weight
      // 6/7 Average Weight
      // 7/8 Minimum Weight
      // 8/9 Huge Chance
      // 9/10 Tier
      // 10/11 Stock
      // 11/12 Multi-Harvest
      // 12/13 Obtainable
      const hasImageColumn = Boolean(cells[1]?.includes("/Grow%20a%20Garden/") || cells[1]?.match(/\.(png|jpg|jpeg|webp)$/i));
      const offset = hasImageColumn ? 1 : 0;
      if (cells.length < 12 + offset) return;
      const name = cells[0];
      const imageUrl = hasImageColumn ? cells[1] : null;
      const baseValueFloor = parseNumber(cells[3 + offset]);
      const averageValue = parseNumber(cells[4 + offset]);
      const baseWeightFloor = parseWeight(cells[5 + offset]);
      const averageWeight = parseWeight(cells[6 + offset]);
      const minWeight = parseWeight(cells[7 + offset]);
      const hugeChance = cells[8 + offset] ? parsePercent(cells[8 + offset]) : null;
      const tier = cells[9 + offset] ?? "";
      const stock = cells[10 + offset] ?? null;
      const obtainable =
        cells[12 + offset]?.toLowerCase() === "✓" || cells[12 + offset]?.toLowerCase() === "yes"
          ? true
          : cells[12 + offset]?.toLowerCase() === "✗" || cells[12 + offset]?.toLowerCase() === "no"
            ? false
            : null;

      if (!name || averageValue === null || averageWeight === null) return;

      crops.push({
        name,
        imageUrl: imageUrl?.trim() || null,
        tier,
        baseValue: averageValue,
        baseWeightKg: averageWeight,
        baseValueFloor,
        baseWeightFloorKg: baseWeightFloor,
        minWeightKg: minWeight,
        hugeChancePercent: hugeChance,
        stock,
        obtainable,
        eventType
      });
    });
  });

  return {
    crops: dedupeByName(crops),
    dataLastUpdatedOn,
    source
  };
}
