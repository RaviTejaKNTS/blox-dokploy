import fs from "node:fs/promises";
import path from "node:path";

export type CropRecord = {
  name: string;
  tier: string;
  baseValue: number; // average value (Sheckles)
  baseWeightKg: number; // average weight in kg
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

const CROPS_MD_PATH = path.join(process.cwd(), "grow-a-garden-crops-data.md");

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
    const parts = line
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
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
    }
  }
  return Array.from(seen.values());
}

export async function loadCropDataset(): Promise<CropDataset> {
  const md = await fs.readFile(CROPS_MD_PATH, "utf8");

  const generatedMatch = md.match(/Generated:\s*([^\n]+)/i);
  const dataLastUpdatedOn = generatedMatch?.[1]?.trim() ?? null;

  const sourceMatch = md.match(/Source:\s*([^\n]+)/i);
  const source = sourceMatch?.[1]?.trim() ?? null;

  const sections = md.split(/^##\s+/gm).filter((section) => section.trim().length > 0);

  const crops: CropRecord[] = [];

  sections.forEach((section) => {
    // Only consider tables with crop info; skip the tier-only lists.
    if (!section.toLowerCase().includes("crops info")) return;

    const { rows, heading } = parseTableBlock(section);
    if (!rows.length) return;

    const eventTypeMatch = heading?.match(/\(([^)]+)\)/);
    const eventType = eventTypeMatch?.[1] ?? null;

    rows.forEach((cells) => {
      // Expected columns after name:
      // [price1, price2, price3, averageValue, floorWeight, averageWeight, minWeight, hugeChance, tier, stock, multi, obtainable]
      if (cells.length < 8) return;
      const name = cells[0];
      const averageValue = parseNumber(cells[4]);
      const averageWeight = parseWeight(cells[6]);
      const minWeight = parseWeight(cells[7]);
      const hugeChance = cells[8] ? parsePercent(cells[8]) : null;
      const tier = cells[9] ?? "";
      const stock = cells[10] ?? null;
      const obtainable =
        cells[12]?.toLowerCase() === "✓" || cells[12]?.toLowerCase() === "yes"
          ? true
          : cells[12]?.toLowerCase() === "✗" || cells[12]?.toLowerCase() === "no"
            ? false
            : null;

      if (!name || averageValue === null || averageWeight === null) return;

      crops.push({
        name,
        tier,
        baseValue: averageValue,
        baseWeightKg: averageWeight,
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
