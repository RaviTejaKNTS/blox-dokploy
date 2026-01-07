import fs from "node:fs/promises";
import path from "node:path";
import type { ArmorPiece, ArmorSlot, ArmorWeightClass, ArmorWeightGroup } from "./data";

export type ForgeArmorDataset = {
  armorPieces: ArmorPiece[];
  dataLastUpdatedOn: string | null;
  source: string | null;
};

const ARMOR_MD_PATHS = [path.join(process.cwd(), "data", "The Forge", "armors.md")];

async function readArmorMarkdown(): Promise<string> {
  for (const candidate of ARMOR_MD_PATHS) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  throw new Error(`Missing armor data file. Expected: ${ARMOR_MD_PATHS.join(", ")}`);
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
  const targetLength = 7;
  if (parts.length === targetLength) return parts;
  if (parts.length > targetLength) return parts.slice(0, targetLength);
  return parts.concat(new Array(targetLength - parts.length).fill(""));
}

export async function loadForgeArmorDataset(): Promise<ForgeArmorDataset> {
  const md = await readArmorMarkdown();

  const sourceMatch = md.match(/Source:\s*([^\n]+)/i);
  const sourceLine = sourceMatch?.[1]?.trim() ?? null;
  const accessedMatch = sourceLine?.match(/\(accessed\s*([^)]+)\)/i) ?? null;
  const dataLastUpdatedOn = accessedMatch?.[1]?.trim() ?? null;
  const source = sourceLine ? sourceLine.replace(accessedMatch?.[0] ?? "", "").trim() : null;

  const rows = parseRows(md);
  const armorPieces: ArmorPiece[] = [];

  rows.forEach((row) => {
    const [name, imageUrl, classLabel, slotLabel, healthValue, priceValue, chanceValue] = normalizeColumns(row);
    if (!name) return;

    const weightClass = normalizeWeightClass(classLabel);
    const slot = normalizeSlot(slotLabel);
    if (!weightClass || !slot) return;

    const baseHealthPercent = parseNumber(healthValue) ?? 0;
    const sellPrice = parseNumber(priceValue);
    const chanceRatio = parseDropChance(chanceValue) ?? 1;

    armorPieces.push({
      id: toSlug(name),
      name,
      weightClass,
      slot,
      baseHealthPercent,
      chanceRatio,
      sellPrice: sellPrice ?? 0,
      baseWeightGroup: weightClassToGroup(weightClass),
      imageUrl: imageUrl || null
    });
  });

  return {
    armorPieces,
    dataLastUpdatedOn,
    source
  };
}
