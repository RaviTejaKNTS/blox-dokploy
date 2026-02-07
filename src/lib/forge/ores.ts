import fs from "node:fs/promises";
import path from "node:path";
import type { Ore, TraitType } from "./data";

export type ForgeOreDataset = {
  ores: Ore[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

type ForgeOreSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type ForgeOreRow = {
  name?: string | null;
  image?: string | null;
  region?: string | null;
  rarity?: string | null;
  dropChance?: string | null;
  multiplier?: string | null;
  sellPrice?: string | null;
  trait?: string | null;
  rocks?: string | null;
  description?: string | null;
};

type ForgeOreJson = {
  meta?: {
    updatedAt?: string | null;
    sources?: ForgeOreSource[] | null;
  } | null;
  items?: ForgeOreRow[] | null;
};

const ORE_JSON_PATH = path.join(process.cwd(), "data", "The Forge", "ores.json");
const RARITY_VALUES: Ore["rarity"][] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythical",
  "Divine",
  "Relic",
  "Exotic"
];

async function readOresJson(): Promise<ForgeOreJson> {
  try {
    const raw = await fs.readFile(ORE_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as ForgeOreJson | ForgeOreRow[];
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    return parsed ?? {};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(`Missing ores data file. Expected: ${ORE_JSON_PATH}`);
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
  const cleaned = value.replace(/[$,]/g, "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseMultiplier(value: string): number | null {
  return parseNumber(value.replace(/x/i, ""));
}

function parseDropChance(value: string): number | null {
  const cleaned = value.replace(/\s+/g, "").trim();
  const match = cleaned.match(/^1\/(.+)$/);
  if (!match) return null;
  return parseNumber(match[1]);
}

function inferTraitType(trait: string): TraitType {
  const normalized = trait.toLowerCase();
  const hasArmor = normalized.includes("armor");
  const hasWeapon = normalized.includes("weapon");
  const hasBoth = normalized.includes("both") || (hasArmor && hasWeapon);
  if (hasBoth) return "both";
  if (hasArmor) {
    if (normalized.includes("aoe") || normalized.includes("area") || normalized.includes("explosion")) {
      return "armor_aoe";
    }
    if (normalized.includes("defense") || normalized.includes("damage reduction")) {
      return "armor_defense";
    }
    if (normalized.includes("speed") || normalized.includes("swiftness")) {
      return "movement";
    }
    return "armor";
  }
  if (hasWeapon) {
    if (normalized.includes("aoe") || normalized.includes("area") || normalized.includes("explosion")) {
      return "weapon_aoe";
    }
    return "weapon";
  }
  if (normalized.includes("speed") || normalized.includes("swiftness") || normalized.includes("movement")) {
    return "movement";
  }
  return null;
}

function normalizeRarity(value: string): Ore["rarity"] {
  const match = RARITY_VALUES.find((rarity) => rarity.toLowerCase() === value.toLowerCase());
  return match ?? "Common";
}

function resolveSource(sources: ForgeOreSource[] | null | undefined): string | null {
  if (!sources || sources.length === 0) return null;
  const primary = sources.find((source) => (source.label ?? "").toLowerCase() === "source" && source.url);
  return primary?.url ?? sources.find((source) => source.url)?.url ?? null;
}

function resolveUpdatedAt(sources: ForgeOreSource[] | null | undefined, updatedAt?: string | null): string | null {
  if (updatedAt) return updatedAt;
  return sources?.find((source) => source.accessed)?.accessed ?? null;
}

export async function loadForgeOreDataset(): Promise<ForgeOreDataset> {
  const json = await readOresJson();
  const items = json.items ?? [];
  const sources = json.meta?.sources ?? null;
  const dataLastUpdatedOn = resolveUpdatedAt(sources ?? undefined, json.meta?.updatedAt ?? null);
  const source = resolveSource(sources ?? undefined);
  const ores: Ore[] = [];

  items.forEach((row) => {
    const name = row.name?.trim();
    if (!name) return;

    const region = row.region?.trim();
    if (!region) return;

    const rarityLabel = row.rarity?.trim() ?? "Common";
    const dropChance = row.dropChance ?? "";
    const multiplier = row.multiplier ?? "";
    const price = row.sellPrice ?? "";
    const trait = row.trait?.trim() ?? "";
    const hasTrait = Boolean(trait && trait.toLowerCase() !== "none");

    const dropChanceRatio = parseDropChance(dropChance) ?? 0;
    const parsedMultiplier = parseMultiplier(multiplier) ?? 0;
    const sellPrice = parseNumber(price);

    ores.push({
      id: toSlug(name),
      name,
      imageUrl: row.image ?? null,
      rarity: normalizeRarity(rarityLabel),
      areaGroup: region as Ore["areaGroup"],
      dropChanceRatio,
      multiplier: parsedMultiplier,
      sellPrice,
      hasTrait,
      traitName: null,
      traitEffectShort: hasTrait ? trait : null,
      traitType: hasTrait ? inferTraitType(trait) : null
    });
  });

  return {
    ores,
    dataLastUpdatedOn,
    source
  };
}
