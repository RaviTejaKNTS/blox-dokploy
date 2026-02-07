import fs from "node:fs/promises";
import path from "node:path";
import type { ArmorPiece, ArmorSlot, ArmorWeightClass, ArmorWeightGroup } from "./data";

export type ForgeArmorDataset = {
  armorPieces: ArmorPiece[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

type ForgeArmorSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type ForgeArmorRow = {
  name?: string | null;
  image?: string | null;
  class?: string | null;
  slot?: string | null;
  baseHealth?: string | null;
  sellPrice?: string | null;
  chance?: string | null;
};

type ForgeArmorJson = {
  meta?: {
    updatedAt?: string | null;
    sources?: ForgeArmorSource[] | null;
  } | null;
  items?: ForgeArmorRow[] | null;
};

const ARMOR_JSON_PATH = path.join(process.cwd(), "data", "The Forge", "armors.json");

async function readArmorJson(): Promise<ForgeArmorJson> {
  try {
    const raw = await fs.readFile(ARMOR_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as ForgeArmorJson | ForgeArmorRow[];
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    return parsed ?? {};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`Missing armor data file. Expected: ${ARMOR_JSON_PATH}`);
    }
    throw err;
  }
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value: string): number | null {
  const cleaned = value
    .replace(/[$,%]/g, "")
    .replace(/\+/, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)([kKmM])?$/);
  if (!match) return null;
  let num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") num *= 1000;
  if (suffix === "m") num *= 1_000_000;
  return num;
}

function parseDropChance(value: string): number | null {
  const cleaned = value.replace(/\s+/g, "").trim();
  const match = cleaned.match(/^1\/(.+)$/);
  if (!match) return null;
  return parseNumber(match[1]);
}

function normalizeWeightClass(value: string): ArmorWeightClass | null {
  const normalized = value.toLowerCase().trim();
  if (normalized === "light") return "Light";
  if (normalized === "medium") return "Medium";
  if (normalized === "heavy") return "Heavy";
  return null;
}

function normalizeSlot(value: string): ArmorSlot | null {
  const normalized = value.toLowerCase().trim();
  if (normalized === "helmet") return "Helmet";
  if (normalized === "chestplate") return "Chestplate";
  if (normalized === "leggings") return "Leggings";
  return null;
}

function weightClassToGroup(weightClass: ArmorWeightClass): ArmorWeightGroup {
  if (weightClass === "Light") return "Light";
  if (weightClass === "Medium") return "Medium";
  return "Heavy";
}

function resolveSource(sources: ForgeArmorSource[] | null | undefined): string | null {
  if (!sources || sources.length === 0) return null;
  const primary = sources.find((source) => (source.label ?? "").toLowerCase() === "source" && source.url);
  return primary?.url ?? sources.find((source) => source.url)?.url ?? null;
}

function resolveUpdatedAt(sources: ForgeArmorSource[] | null | undefined, updatedAt?: string | null): string | null {
  if (updatedAt) return updatedAt;
  return sources?.find((source) => source.accessed)?.accessed ?? null;
}

export async function loadForgeArmorDataset(): Promise<ForgeArmorDataset> {
  const json = await readArmorJson();
  const items = json.items ?? [];
  const sources = json.meta?.sources ?? null;
  const dataLastUpdatedOn = resolveUpdatedAt(sources ?? undefined, json.meta?.updatedAt ?? null);
  const source = resolveSource(sources ?? undefined);
  const armorPieces: ArmorPiece[] = [];

  items.forEach((row) => {
    const name = row.name?.trim();
    if (!name) return;

    const classLabel = row.class?.trim() ?? "";
    const slotLabel = row.slot?.trim() ?? "";
    const weightClass = normalizeWeightClass(classLabel);
    const slot = normalizeSlot(slotLabel);
    if (!weightClass || !slot) return;

    const baseHealthPercent = parseNumber(row.baseHealth ?? "") ?? 0;
    const sellPrice = parseNumber(row.sellPrice ?? "");
    const chanceRatio = parseDropChance(row.chance ?? "") ?? 1;

    armorPieces.push({
      id: toSlug(name),
      name,
      weightClass,
      slot,
      baseHealthPercent,
      chanceRatio,
      sellPrice: sellPrice ?? 0,
      baseWeightGroup: weightClassToGroup(weightClass),
      imageUrl: row.image ?? null
    });
  });

  return {
    armorPieces,
    dataLastUpdatedOn,
    source
  };
}
