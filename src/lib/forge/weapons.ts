import fs from "node:fs/promises";
import path from "node:path";
import { WEAPON_CLASS_THRESHOLDS, type Weapon, type WeaponClass } from "./data";

export type ForgeWeaponDataset = {
  weapons: Weapon[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

const WEAPON_MD_PATHS = [path.join(process.cwd(), "data", "The Forge", "weapons.md")];

async function readWeaponsMarkdown(): Promise<string> {
  for (const candidate of WEAPON_MD_PATHS) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  throw new Error(`Missing weapons data file. Expected: ${WEAPON_MD_PATHS.join(", ")}`);
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

function parseRows(md: string): string[][] {
  const lines = md
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const tableStart = lines.findIndex((line) => line.startsWith("|"));
  if (tableStart === -1) return [];

  const rows: string[][] = [];
  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    const parts = line.split("|").slice(1, -1).map((part) => part.trim());
    rows.push(parts);
  }
  return rows;
}

function normalizeColumns(parts: string[]): string[] {
  const targetLength = 8;
  if (parts.length === targetLength) return parts;
  if (parts.length > targetLength) return parts.slice(0, targetLength);
  return parts.concat(new Array(targetLength - parts.length).fill(""));
}

export async function loadForgeWeaponDataset(): Promise<ForgeWeaponDataset> {
  const md = await readWeaponsMarkdown();

  const sourceMatch = md.match(/Source:\s*([^\n]+)/i);
  const sourceLine = sourceMatch?.[1]?.trim() ?? null;
  const accessedMatch = sourceLine?.match(/\(accessed\s*([^)]+)\)/i) ?? null;
  const dataLastUpdatedOn = accessedMatch?.[1]?.trim() ?? null;
  const source = sourceLine ? sourceLine.replace(accessedMatch?.[0] ?? "", "").trim() : null;

  const rows = parseRows(md);
  const weapons: Weapon[] = [];

  rows.forEach((row) => {
    const [name, imageUrl, classLabel, baseDamageValue, speedValue, rangeValue, priceValue, chanceValue] =
      normalizeColumns(row);
    if (!name) return;

    const weaponClass = normalizeWeaponClass(classLabel);
    if (!weaponClass) return;

    const thresholds = WEAPON_CLASS_THRESHOLDS[weaponClass];
    if (!thresholds) return;

    const baseDamage = parseNumber(baseDamageValue) ?? 0;
    const baseSpeedSeconds = parseNumber(speedValue) ?? 0;
    const baseRange = parseNumber(rangeValue) ?? 0;
    const sellPrice = parseNumber(priceValue);
    const internalWeightRatio = parseDropChance(chanceValue) ?? 1;

    weapons.push({
      id: toSlug(name),
      name,
      imageUrl: imageUrl || null,
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
