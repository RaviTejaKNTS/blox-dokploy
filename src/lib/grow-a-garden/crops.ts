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

type CropSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type CropRow = {
  name?: string | null;
  image?: string | null;
  shecklesPrice?: string | null;
  robuxPrice?: string | null;
  priceFloorValue?: string | null;
  averageValue?: string | null;
  priceFloorWeight?: string | null;
  averageWeight?: string | null;
  minimumWeight?: string | null;
  hugeChance?: string | null;
  tier?: string | null;
  stock?: string | null;
  multiHarvest?: string | null;
  obtainable?: string | null;
  eventType?: string | null;
};

type CropJson = {
  meta?: {
    updatedAt?: string | null;
    sources?: CropSource[] | null;
    source?: string | null;
  } | null;
  items?: CropRow[] | null;
};

const CROPS_JSON_PATH = path.join(process.cwd(), "data", "Grow a Garden", "crops.json");

async function readCropsJson(): Promise<CropJson> {
  try {
    const raw = await fs.readFile(CROPS_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as CropJson | CropRow[];
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    return parsed ?? {};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`Missing crops data file. Expected: ${CROPS_JSON_PATH}`);
    }
    throw err;
  }
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

function resolveUpdatedAt(sources: CropSource[] | null | undefined, updatedAt?: string | null): string | null {
  if (updatedAt) return updatedAt;
  return sources?.find((source) => source.accessed)?.accessed ?? null;
}

function resolveSource(sources: CropSource[] | null | undefined, fallback?: string | null): string | null {
  if (fallback) return fallback;
  if (!sources || sources.length === 0) return null;
  const urls = sources.map((source) => source.url).filter((value): value is string => Boolean(value));
  return urls.length ? urls.join(" | ") : null;
}

export async function loadCropDataset(): Promise<CropDataset> {
  const json = await readCropsJson();
  const items = json.items ?? [];
  const sources = json.meta?.sources ?? null;
  const dataLastUpdatedOn = resolveUpdatedAt(sources ?? undefined, json.meta?.updatedAt ?? null);
  const source = resolveSource(sources ?? undefined, json.meta?.source ?? null);

  const crops: CropRecord[] = [];

  items.forEach((row) => {
    const name = row.name?.trim();
    if (!name) return;

    const averageValue = parseNumber(row.averageValue ?? "");
    const averageWeight = parseWeight(row.averageWeight ?? "");
    if (averageValue === null || averageWeight === null) return;

    const baseValueFloor = parseNumber(row.priceFloorValue ?? "");
    const baseWeightFloor = parseWeight(row.priceFloorWeight ?? "");
    const minWeight = parseWeight(row.minimumWeight ?? "");
    const hugeChance = row.hugeChance ? parsePercent(row.hugeChance) : null;
    const tier = row.tier ?? "";
    const stock = row.stock ?? null;
    const obtainableLabel = row.obtainable?.toLowerCase() ?? "";
    const obtainable =
      obtainableLabel === "✓" || obtainableLabel === "yes"
        ? true
        : obtainableLabel === "✗" || obtainableLabel === "no"
          ? false
          : null;

    crops.push({
      name,
      imageUrl: row.image?.trim() || null,
      tier,
      baseValue: averageValue,
      baseWeightKg: averageWeight,
      baseValueFloor,
      baseWeightFloorKg: baseWeightFloor,
      minWeightKg: minWeight,
      hugeChancePercent: hugeChance,
      stock,
      obtainable,
      eventType: row.eventType ?? null
    });
  });

  return {
    crops: dedupeByName(crops),
    dataLastUpdatedOn,
    source
  };
}
