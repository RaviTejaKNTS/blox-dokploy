import {
  ARMOR_PIECES,
  ARMOR_WEIGHT_THRESHOLDS,
  MAX_TOTAL_ORE_COUNT,
  MIN_TOTAL_ORE_COUNT,
  ORES_BY_ID,
  WEAPON_CLASS_THRESHOLDS,
  WEAPONS,
  type ArmorPiece,
  type ArmorSlot,
  type ArmorWeightGroup,
  type Ore,
  type Weapon,
  type WeaponClass
} from "./data";

export type OreSelection = { oreId: string; count: number };

export type OreUsage = {
  ore: Ore;
  count: number;
  share: number;
};

export type TraitActivation = {
  ore: Ore;
  share: number;
  optimal: boolean;
};

export type WeaponClassProbability = {
  class: WeaponClass;
  probability: number;
  score: number;
  minOre: number;
  optimalOre: number;
};

export type WeaponOutcome = {
  weapon: Weapon;
  probability: number;
  classProbability: number;
  finalDamage: number;
};

export type ArmorWeightProbability = {
  weight: ArmorWeightGroup;
  probability: number;
  score: number;
  minOre: number;
  optimalOre: number;
};

export type ArmorOutcome = {
  armor: ArmorPiece;
  probability: number;
  weightProbability: number;
  finalHealthPercent: number;
};

function normalizeSelections(selections: OreSelection[]): OreUsage[] {
  const merged = new Map<string, number>();
  selections.forEach(({ oreId, count }) => {
    const ore = ORES_BY_ID[oreId];
    if (!ore) return;
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount <= 0) return;
    merged.set(oreId, (merged.get(oreId) ?? 0) + safeCount);
  });

  const total = Array.from(merged.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  return Array.from(merged.entries()).map(([oreId, count]) => {
    const ore = ORES_BY_ID[oreId];
    return {
      ore,
      count,
      share: count / total
    };
  });
}

export function aggregateOreSelections(selections: OreSelection[]): { usages: OreUsage[]; totalCount: number } {
  const usages = normalizeSelections(selections);
  const totalCount = usages.reduce((sum, usage) => sum + usage.count, 0);
  return { usages, totalCount };
}

export function calculateTotalMultiplier(usages: OreUsage[], totalCount: number): number {
  if (totalCount === 0) return 0;
  const weighted = usages.reduce((sum, usage) => sum + usage.count * usage.ore.multiplier, 0);
  return weighted / totalCount;
}

export function calculateTraitActivations(usages: OreUsage[], totalCount: number): TraitActivation[] {
  if (totalCount === 0) return [];
  return usages
    .filter(({ ore }) => ore.hasTrait)
    .map(({ ore, share }) => ({
      ore,
      share,
      optimal: share >= 0.3
    }))
    .filter((entry) => entry.share >= 0.1)
    .sort((a, b) => b.share - a.share);
}

function scoreFromThresholds(totalCount: number, minOre: number, optimalOre: number): number {
  // Approximate Forge scoring using guide min/optimal thresholds (not official game RNG).
  if (totalCount < minOre) return 0;
  if (totalCount >= optimalOre) return 1;
  return (totalCount - minOre) / (optimalOre - minOre);
}

function normalizeScores<T extends { score: number }>(entries: T[]): Array<T & { probability: number }> {
  const positive = entries.filter((entry) => entry.score > 0);
  if (positive.length === 1) {
    return entries.map((entry) => ({
      ...entry,
      probability: entry === positive[0] ? 1 : 0
    })) as Array<T & { probability: number }>;
  }

  const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0);
  if (totalScore === 0) {
    return entries.map((entry) => ({
      ...entry,
      probability: 0
    })) as Array<T & { probability: number }>;
  }

  return entries.map((entry) => ({
    ...entry,
    probability: entry.score / totalScore
  })) as Array<T & { probability: number }>;
}

export function calculateWeaponClassProbabilities(totalCount: number): WeaponClassProbability[] {
  const effectiveCount = Math.min(totalCount, MAX_TOTAL_ORE_COUNT);
  const entries = (Object.keys(WEAPON_CLASS_THRESHOLDS) as WeaponClass[]).map((weaponClass) => {
    const { minOre, optimalOre } = WEAPON_CLASS_THRESHOLDS[weaponClass];
    const score = scoreFromThresholds(effectiveCount, minOre, optimalOre);
    return {
      class: weaponClass,
      score,
      probability: 0,
      minOre,
      optimalOre
    };
  });

  return normalizeScores(entries);
}

export function calculateArmorWeightProbabilities(totalCount: number): ArmorWeightProbability[] {
  const effectiveCount = Math.min(totalCount, MAX_TOTAL_ORE_COUNT);
  const entries = (Object.keys(ARMOR_WEIGHT_THRESHOLDS) as ArmorWeightGroup[]).map((weight) => {
    const { minOre, optimalOre } = ARMOR_WEIGHT_THRESHOLDS[weight];
    const score = scoreFromThresholds(effectiveCount, minOre, optimalOre);
    return {
      weight,
      score,
      probability: 0,
      minOre,
      optimalOre
    };
  });

  return normalizeScores(entries);
}

function normalizeInternalWeights<T extends { chanceRatio: number }>(items: T[]): Array<T & { weight: number; normalized: number }> {
  const weighted = items.map((item) => ({
    ...item,
    weight: item.chanceRatio > 0 ? 1 / item.chanceRatio : 0
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) {
    return weighted.map((item) => ({
      ...item,
      normalized: 0
    }));
  }
  return weighted.map((item) => ({
    ...item,
    normalized: item.weight / totalWeight
  }));
}

export function calculateWeaponOutcomes(
  totalCount: number,
  multiplier: number
): { classProbabilities: WeaponClassProbability[]; weapons: WeaponOutcome[] } {
  const classProbabilities = calculateWeaponClassProbabilities(totalCount);
  const weapons: WeaponOutcome[] = [];

  classProbabilities.forEach((classEntry) => {
    const items = WEAPONS.filter((weapon) => weapon.class === classEntry.class).map((weapon) => ({
      ...weapon,
      chanceRatio: weapon.internalWeightRatio
    }));
    const weightedItems = normalizeInternalWeights(items);

    weightedItems.forEach((item) => {
      weapons.push({
        weapon: item,
        classProbability: classEntry.probability,
        probability: classEntry.probability * item.normalized,
        finalDamage: item.baseDamage * multiplier
      });
    });
  });

  return { classProbabilities, weapons };
}

export function calculateArmorOutcomes(
  totalCount: number,
  multiplier: number,
  slot: ArmorSlot
): { weightProbabilities: ArmorWeightProbability[]; armor: ArmorOutcome[] } {
  const weightProbabilities = calculateArmorWeightProbabilities(totalCount);
  const armor: ArmorOutcome[] = [];

  weightProbabilities.forEach((weightEntry) => {
    const items = ARMOR_PIECES.filter(
      (piece) => piece.slot === slot && piece.baseWeightGroup === weightEntry.weight
    );
    const weightedItems = normalizeInternalWeights(items);

    weightedItems.forEach((item) => {
      armor.push({
        armor: item,
        weightProbability: weightEntry.probability,
        probability: weightEntry.probability * item.normalized,
        finalHealthPercent: item.baseHealthPercent * multiplier
      });
    });
  });

  return { weightProbabilities, armor };
}

export function clampTotalCount(totalCount: number): number {
  if (totalCount < MIN_TOTAL_ORE_COUNT) return totalCount;
  return Math.min(totalCount, MAX_TOTAL_ORE_COUNT);
}

export function getOreComposition(usages: OreUsage[]): Array<{ ore: Ore; share: number; count: number }> {
  return usages
    .map(({ ore, share, count }) => ({ ore, share, count }))
    .sort((a, b) => b.share - a.share);
}
