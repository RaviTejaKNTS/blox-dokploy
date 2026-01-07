import fs from "node:fs/promises";
import path from "node:path";
import type { Ore, TraitType } from "./data";

export type ForgeOreDataset = {
  ores: Ore[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

const ORE_MD_PATHS = [path.join(process.cwd(), "data", "The Forge", "ores.md")];
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

async function readOresMarkdown(): Promise<string> {
  for (const candidate of ORE_MD_PATHS) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  throw new Error(`Missing ores data file. Expected: ${ORE_MD_PATHS.join(", ")}`);
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

function parseSections(md: string): Array<{ zone: string; rows: string[][] }> {
  const sections = md.split(/^##\s+/gm).filter((section) => section.trim().length > 0);
  const parsed: Array<{ zone: string; rows: string[][] }> = [];

  sections.forEach((section) => {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const zone = lines[0];
    const tableStart = lines.findIndex((line) => line.startsWith("|"));
    if (tableStart === -1) return;

    const rows: string[][] = [];
    for (let i = tableStart + 2; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.startsWith("|")) break;
      const parts = line.split("|").slice(1, -1).map((part) => part.trim());
      if (!parts.length) continue;
      rows.push(parts);
    }

    if (rows.length) {
      parsed.push({ zone, rows });
    }
  });

  return parsed;
}

function normalizeColumns(parts: string[]): string[] {
  const targetLength = 10;

  if (parts.length === 10) return parts;
  if (parts.length === 9) {
    const [name, image, rarity, chance, multiplier, price, trait, rocks, description] = parts;
    return [name, image, "", rarity, chance, multiplier, price, trait, rocks, description];
  }
  if (parts.length === 8) {
    const [name, rarity, chance, multiplier, price, trait, rocks, description] = parts;
    return [name, "", "", rarity, chance, multiplier, price, trait, rocks, description];
  }
  if (parts.length > 10) {
    const name = parts[0];
    const image = parts[1];
    const region = parts[2];
    const rarity = parts[3];
    const chance = parts[4];
    const multiplier = parts[5];
    const price = parts[6];
    const rocks = parts[parts.length - 2];
    const description = parts[parts.length - 1];
    const trait = parts.slice(7, parts.length - 2).filter(Boolean).join(" / ");
    return [name, image, region, rarity, chance, multiplier, price, trait, rocks, description];
  }
  return parts.concat(new Array(targetLength - parts.length).fill(""));
}

export async function loadForgeOreDataset(): Promise<ForgeOreDataset> {
  const md = await readOresMarkdown();

  const sourceMatch = md.match(/Source:\s*([^\n]+)/i);
  const sourceLine = sourceMatch?.[1]?.trim() ?? null;
  const accessedMatch = sourceLine?.match(/\(accessed\s*([^)]+)\)/i) ?? null;
  const dataLastUpdatedOn = accessedMatch?.[1]?.trim() ?? null;
  const source = sourceLine ? sourceLine.replace(accessedMatch?.[0] ?? "", "").trim() : null;

  const sections = parseSections(md);
  const ores: Ore[] = [];

  sections.forEach(({ zone, rows }) => {
    rows.forEach((row) => {
      const [name, imageUrl, , rarity, chance, multiplier, price, trait, ,] = normalizeColumns(row);
      if (!name) return;

      const dropChanceRatio = parseDropChance(chance);
      const parsedMultiplier = parseMultiplier(multiplier);
      const sellPrice = parseNumber(price);
      const hasTrait = Boolean(trait && trait.toLowerCase() !== "none");

      ores.push({
        id: toSlug(name),
        name,
        imageUrl: imageUrl || null,
        rarity: normalizeRarity(rarity || "Common"),
        areaGroup: zone as Ore["areaGroup"],
        dropChanceRatio: dropChanceRatio ?? 0,
        multiplier: parsedMultiplier ?? 0,
        sellPrice,
        hasTrait,
        traitName: null,
        traitEffectShort: hasTrait ? trait : null,
        traitType: hasTrait ? inferTraitType(trait) : null
      });
    });
  });

  return {
    ores,
    dataLastUpdatedOn,
    source
  };
}
