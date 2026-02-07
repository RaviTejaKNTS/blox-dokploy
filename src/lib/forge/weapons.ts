import fs from "node:fs/promises";
import path from "node:path";
import { WEAPON_CLASS_THRESHOLDS, type Weapon, type WeaponClass } from "./data";

export type ForgeWeaponDataset = {
  weapons: Weapon[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

type ForgeWeaponSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type ForgeWeaponRow = {
  name?: string | null;
  image?: string | null;
  class?: string | null;
  baseDamage?: string | null;
  attackSpeed?: string | null;
  range?: string | null;
  sellPrice?: string | null;
  chance?: string | null;
};

type ForgeWeaponJson = {
  meta?: {
    updatedAt?: string | null;
    sources?: ForgeWeaponSource[] | null;
  } | null;
  items?: ForgeWeaponRow[] | null;
};

const WEAPON_JSON_PATH = path.join(process.cwd(), "data", "The Forge", "weapons.json");

async function readWeaponsJson(): Promise<ForgeWeaponJson> {
  try {
    const raw = await fs.readFile(WEAPON_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as ForgeWeaponJson | ForgeWeaponRow[];
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    return parsed ?? {};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`Missing weapons data file. Expected: ${WEAPON_JSON_PATH}`);
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
    .replace(/dmg/gi, "")
    .replace(/studs?/gi, "")
    .replace(/sec(onds?)?/gi, "")
    .replace(/\+/, "")
    .replace(/\s+/g, "")
    .replace(/s$/i, "")
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

function normalizeWeaponClass(value: string): WeaponClass | null {
  const normalized = value.toLowerCase().trim();
  const mapping: Record<string, WeaponClass> = {
    dagger: "Dagger",
    daggers: "Dagger",
    "straight sword": "Straight Sword",
    "straight swords": "Straight Sword",
    gauntlet: "Gauntlet",
    katanas: "Katana",
    katana: "Katana",
    "great sword": "Great Sword",
    "great swords": "Great Sword",
    "great axe": "Great Axe",
    "great axes": "Great Axe",
    "colossal sword": "Colossal Sword",
    "colossal swords": "Colossal Sword"
  };
  return mapping[normalized] ?? null;
}

function resolveSource(sources: ForgeWeaponSource[] | null | undefined): string | null {
  if (!sources || sources.length === 0) return null;
  const primary = sources.find((source) => (source.label ?? "").toLowerCase() === "source" && source.url);
  return primary?.url ?? sources.find((source) => source.url)?.url ?? null;
}

function resolveUpdatedAt(sources: ForgeWeaponSource[] | null | undefined, updatedAt?: string | null): string | null {
  if (updatedAt) return updatedAt;
  return sources?.find((source) => source.accessed)?.accessed ?? null;
}

export async function loadForgeWeaponDataset(): Promise<ForgeWeaponDataset> {
  const json = await readWeaponsJson();
  const items = json.items ?? [];
  const sources = json.meta?.sources ?? null;
  const dataLastUpdatedOn = resolveUpdatedAt(sources ?? undefined, json.meta?.updatedAt ?? null);
  const source = resolveSource(sources ?? undefined);
  const weapons: Weapon[] = [];

  items.forEach((row) => {
    const name = row.name?.trim();
    if (!name) return;

    const weaponClass = normalizeWeaponClass(row.class ?? "");
    if (!weaponClass) return;

    const thresholds = WEAPON_CLASS_THRESHOLDS[weaponClass];
    if (!thresholds) return;

    const baseDamage = parseNumber(row.baseDamage ?? "") ?? 0;
    const baseSpeedSeconds = parseNumber(row.attackSpeed ?? "") ?? 0;
    const baseRange = parseNumber(row.range ?? "") ?? 0;
    const sellPrice = parseNumber(row.sellPrice ?? "");
    const internalWeightRatio = parseDropChance(row.chance ?? "") ?? 1;

    weapons.push({
      id: toSlug(name),
      name,
      imageUrl: row.image ?? null,
      class: weaponClass,
      baseDamage,
      baseSpeedSeconds,
      baseRange,
      sellPrice: sellPrice ?? 0,
      internalWeightRatio,
      classMinOre: thresholds.minOre,
      classOptimalOre: thresholds.optimalOre
    });
  });

  return {
    weapons,
    dataLastUpdatedOn,
    source
  };
}
