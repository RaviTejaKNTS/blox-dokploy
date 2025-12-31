import {
  ARMOR_PIECES,
  ARMOR_PIECE_ANCHORS,
  WEAPON_CLASS_ANCHORS,
  WEAPONS,
  type ArmorPiece,
  type ArmorSlot,
  type ArmorPieceAnchorKey,
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
  tier: "minor" | "full";
};

export type WeaponClassProbability = {
  class: WeaponClass;
  probability: number;
  weight: number;
  minOre: number;
  optimalOre: number;
  minChance: number;
  optimalChance: number;
};

export type WeaponOutcome = {
  weapon: Weapon;
  probability: number;
  classProbability: number;
  finalDamage: number;
};

export type ArmorPieceProbability = {
  key: ArmorPieceAnchorKey;
  weightGroup: ArmorWeightGroup;
  slot: ArmorSlot;
  probability: number;
  weight: number;
  minOre: number;
  optimalOre: number;
  minChance: number;
  optimalChance: number;
};

export type ArmorOutcome = {
  armor: ArmorPiece;
  probability: number;
  groupProbability: number;
  anchorKey: ArmorPieceAnchorKey;
  finalHealthPercent: number;
};

function normalizeSelections(selections: OreSelection[], oresById: Record<string, Ore>): OreUsage[] {
  const merged = new Map<string, number>();
  selections.forEach(({ oreId, count }) => {
    const ore = oresById[oreId];
    if (!ore) return;
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount <= 0) return;
    merged.set(oreId, (merged.get(oreId) ?? 0) + safeCount);
  });

  const total = Array.from(merged.values()).reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];

  return Array.from(merged.entries()).map(([oreId, count]) => {
    const ore = oresById[oreId];
    return {
      ore,
      count,
      share: count / total
    };
  });
}

export function aggregateOreSelections(
  selections: OreSelection[],
  oresById: Record<string, Ore>
): { usages: OreUsage[]; totalCount: number } {
  const usages = normalizeSelections(selections, oresById);
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
    .map(({ ore, share }) => {
      if (share < 0.1) return null;
      return {
        ore,
        share,
        tier: share >= 0.3 ? "full" : "minor"
      };
    })
    .filter((entry): entry is TraitActivation => Boolean(entry))
    .sort((a, b) => b.share - a.share);
}

type WeightCurve = {
  minOre: number;
  optimalOre: number;
  minWeight: number;
  optimalWeight: number;
};

function weightAt(totalCount: number, curve: WeightCurve): number {
  if (totalCount < curve.minOre) return 0;
  if (curve.minOre === curve.optimalOre) return curve.minWeight;
  if (totalCount >= curve.optimalOre) return curve.optimalWeight;
  const t = (totalCount - curve.minOre) / (curve.optimalOre - curve.minOre);
  return curve.minWeight + t * (curve.optimalWeight - curve.minWeight);
}

function normalizeWeights<T extends { weight: number }>(entries: T[]): Array<T & { probability: number }> {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) {
    return entries.map((entry) => ({
      ...entry,
      probability: 0
    })) as Array<T & { probability: number }>;
  }
  return entries.map((entry) => ({
    ...entry,
    probability: entry.weight / totalWeight
  })) as Array<T & { probability: number }>;
}

function ratioFromChance(chance: number): number {
  return chance / (1 - chance);
}

function solveBisection(fn: (value: number) => number, low: number, high: number): number {
  let left = low;
  let right = high;
  let fLeft = fn(left);
  let fRight = fn(right);
  let guard = 0;

  while (fLeft * fRight > 0 && guard < 20) {
    right *= 2;
    fRight = fn(right);
    guard += 1;
  }

  if (fLeft * fRight > 0) {
    return right;
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = (left + right) / 2;
    const fMid = fn(mid);
    if (Math.abs(fMid) < 1e-10) return mid;
    if (fLeft * fMid <= 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  return (left + right) / 2;
}

// Solve monotonic weight curves so normalized probabilities hit the published anchor points.
function buildWeaponClassWeightCurves(): Record<WeaponClass, WeightCurve> {
  const dagger = WEAPON_CLASS_ANCHORS.Dagger;
  const straight = WEAPON_CLASS_ANCHORS["Straight Sword"];
  const gauntlet = WEAPON_CLASS_ANCHORS.Gauntlet;
  const katana = WEAPON_CLASS_ANCHORS.Katana;
  const greatSword = WEAPON_CLASS_ANCHORS["Great Sword"];
  const greatAxe = WEAPON_CLASS_ANCHORS["Great Axe"];
  const colossal = WEAPON_CLASS_ANCHORS["Colossal Sword"];

  const daggerCurve: WeightCurve = {
    minOre: dagger.minOre,
    optimalOre: dagger.optimalOre,
    minWeight: 1,
    optimalWeight: 1
  };

  const straightMinWeight = ratioFromChance(straight.minChance) * weightAt(straight.minOre, daggerCurve);
  const straightOptWeight = ratioFromChance(straight.optimalChance) * weightAt(straight.optimalOre, daggerCurve);
  const straightCurve: WeightCurve = {
    minOre: straight.minOre,
    optimalOre: straight.optimalOre,
    minWeight: straightMinWeight,
    optimalWeight: straightOptWeight
  };

  const gauntletMinWeight =
    ratioFromChance(gauntlet.minChance) * (weightAt(gauntlet.minOre, daggerCurve) + weightAt(gauntlet.minOre, straightCurve));
  const sumNonAnchoredAt9 =
    weightAt(katana.minOre, daggerCurve) + weightAt(katana.minOre, straightCurve);
  const totalAt9 = sumNonAnchoredAt9 / (1 - (gauntlet.optimalChance + katana.minChance));
  const gauntletOptWeight = gauntlet.optimalChance * totalAt9;
  const katanaMinWeight = katana.minChance * totalAt9;
  const gauntletCurve: WeightCurve = {
    minOre: gauntlet.minOre,
    optimalOre: gauntlet.optimalOre,
    minWeight: gauntletMinWeight,
    optimalWeight: gauntletOptWeight
  };

  const sumNonAnchoredAt12 =
    weightAt(greatSword.minOre, daggerCurve) +
    weightAt(greatSword.minOre, straightCurve) +
    weightAt(greatSword.minOre, gauntletCurve);
  const totalAt12 = sumNonAnchoredAt12 / (1 - (katana.optimalChance + greatSword.minChance));
  const katanaOptWeight = katana.optimalChance * totalAt12;
  const greatSwordMinWeight = greatSword.minChance * totalAt12;
  const katanaCurve: WeightCurve = {
    minOre: katana.minOre,
    optimalOre: katana.optimalOre,
    minWeight: katanaMinWeight,
    optimalWeight: katanaOptWeight
  };

  const sumNonAnchoredAt16 =
    weightAt(greatAxe.minOre, daggerCurve) +
    weightAt(greatAxe.minOre, straightCurve) +
    weightAt(greatAxe.minOre, gauntletCurve) +
    weightAt(greatAxe.minOre, katanaCurve);
  const totalAt16 = sumNonAnchoredAt16 / (1 - (greatSword.optimalChance + greatAxe.minChance));
  const greatSwordOptWeight = greatSword.optimalChance * totalAt16;
  const greatAxeMinWeight = greatAxe.minChance * totalAt16;
  const greatSwordCurve: WeightCurve = {
    minOre: greatSword.minOre,
    optimalOre: greatSword.optimalOre,
    minWeight: greatSwordMinWeight,
    optimalWeight: greatSwordOptWeight
  };

  const baseSum =
    weightAt(colossal.minOre, daggerCurve) +
    weightAt(colossal.minOre, straightCurve) +
    weightAt(colossal.minOre, gauntletCurve) +
    weightAt(colossal.minOre, katanaCurve) +
    weightAt(colossal.minOre, greatSwordCurve);

  const greatAxeOptWeight = solveBisection((guess) => {
    const wGa21 =
      greatAxeMinWeight +
      ((colossal.minOre - greatAxe.minOre) / (greatAxe.optimalOre - greatAxe.minOre)) * (guess - greatAxeMinWeight);
    const wCo21 = ratioFromChance(colossal.minChance) * (baseSum + wGa21);
    const wCo50 = ratioFromChance(colossal.optimalChance) * (baseSum + guess);
    const wCo22 = wCo21 + ((greatAxe.optimalOre - colossal.minOre) / (colossal.optimalOre - colossal.minOre)) * (wCo50 - wCo21);
    const expected = ratioFromChance(greatAxe.optimalChance) * (baseSum + wCo22);
    return expected - guess;
  }, greatAxeMinWeight, greatAxeMinWeight * 1000);

  const greatAxeCurve: WeightCurve = {
    minOre: greatAxe.minOre,
    optimalOre: greatAxe.optimalOre,
    minWeight: greatAxeMinWeight,
    optimalWeight: greatAxeOptWeight
  };

  const colossalMinWeight =
    ratioFromChance(colossal.minChance) * (baseSum + weightAt(colossal.minOre, greatAxeCurve));
  const colossalOptWeight = ratioFromChance(colossal.optimalChance) * (baseSum + greatAxeOptWeight);
  const colossalCurve: WeightCurve = {
    minOre: colossal.minOre,
    optimalOre: colossal.optimalOre,
    minWeight: colossalMinWeight,
    optimalWeight: colossalOptWeight
  };

  return {
    Dagger: daggerCurve,
    "Straight Sword": straightCurve,
    Gauntlet: gauntletCurve,
    Katana: katanaCurve,
    "Great Sword": greatSwordCurve,
    "Great Axe": greatAxeCurve,
    "Colossal Sword": colossalCurve
  };
}

// Armor piece weights are derived the same way, using anchor points for each base slot + weight group.
function buildArmorPieceWeightCurves(): Record<ArmorPieceAnchorKey, WeightCurve> {
  const lightHelmet = ARMOR_PIECE_ANCHORS["Light-Helmet"];
  const lightLeggings = ARMOR_PIECE_ANCHORS["Light-Leggings"];
  const lightChestplate = ARMOR_PIECE_ANCHORS["Light-Chestplate"];
  const mediumHelmet = ARMOR_PIECE_ANCHORS["Medium-Helmet"];
  const mediumLeggings = ARMOR_PIECE_ANCHORS["Medium-Leggings"];
  const mediumChestplate = ARMOR_PIECE_ANCHORS["Medium-Chestplate"];
  const heavyHelmet = ARMOR_PIECE_ANCHORS["Heavy-Helmet"];
  const heavyLeggings = ARMOR_PIECE_ANCHORS["Heavy-Leggings"];
  const heavyChestplate = ARMOR_PIECE_ANCHORS["Heavy-Chestplate"];

  const lightHelmetCurve: WeightCurve = {
    minOre: lightHelmet.minOre,
    optimalOre: lightHelmet.optimalOre,
    minWeight: 1,
    optimalWeight: 1
  };

  const lightLeggingsMinWeight =
    ratioFromChance(lightLeggings.minChance) * weightAt(lightLeggings.minOre, lightHelmetCurve);
  const totalAt7 = weightAt(lightLeggings.optimalOre, lightHelmetCurve) / (1 - (lightLeggings.optimalChance + lightChestplate.minChance));
  const lightLeggingsOptWeight = lightLeggings.optimalChance * totalAt7;
  const lightChestplateMinWeight = lightChestplate.minChance * totalAt7;
  const lightLeggingsCurve: WeightCurve = {
    minOre: lightLeggings.minOre,
    optimalOre: lightLeggings.optimalOre,
    minWeight: lightLeggingsMinWeight,
    optimalWeight: lightLeggingsOptWeight
  };

  const sumNonAnchoredAt10 =
    weightAt(lightChestplate.optimalOre, lightHelmetCurve) +
    weightAt(lightChestplate.optimalOre, lightLeggingsCurve);
  const totalAt10 = sumNonAnchoredAt10 / (1 - (lightChestplate.optimalChance + mediumHelmet.minChance));
  const lightChestplateOptWeight = lightChestplate.optimalChance * totalAt10;
  const mediumHelmetMinWeight = mediumHelmet.minChance * totalAt10;
  const lightChestplateCurve: WeightCurve = {
    minOre: lightChestplate.minOre,
    optimalOre: lightChestplate.optimalOre,
    minWeight: lightChestplateMinWeight,
    optimalWeight: lightChestplateOptWeight
  };

  const sumNonAnchoredAt13 =
    weightAt(mediumHelmet.optimalOre, lightHelmetCurve) +
    weightAt(mediumHelmet.optimalOre, lightLeggingsCurve) +
    weightAt(mediumHelmet.optimalOre, lightChestplateCurve);
  const totalAt13 = sumNonAnchoredAt13 / (1 - (mediumHelmet.optimalChance + mediumLeggings.minChance));
  const mediumHelmetOptWeight = mediumHelmet.optimalChance * totalAt13;
  const mediumLeggingsMinWeight = mediumLeggings.minChance * totalAt13;
  const mediumHelmetCurve: WeightCurve = {
    minOre: mediumHelmet.minOre,
    optimalOre: mediumHelmet.optimalOre,
    minWeight: mediumHelmetMinWeight,
    optimalWeight: mediumHelmetOptWeight
  };

  const sumNonAnchoredAt17 =
    weightAt(mediumLeggings.optimalOre, lightHelmetCurve) +
    weightAt(mediumLeggings.optimalOre, lightLeggingsCurve) +
    weightAt(mediumLeggings.optimalOre, lightChestplateCurve) +
    weightAt(mediumLeggings.optimalOre, mediumHelmetCurve);
  const totalAt17 = sumNonAnchoredAt17 / (1 - (mediumLeggings.optimalChance + mediumChestplate.minChance));
  const mediumLeggingsOptWeight = mediumLeggings.optimalChance * totalAt17;
  const mediumChestplateMinWeight = mediumChestplate.minChance * totalAt17;
  const mediumLeggingsCurve: WeightCurve = {
    minOre: mediumLeggings.minOre,
    optimalOre: mediumLeggings.optimalOre,
    minWeight: mediumLeggingsMinWeight,
    optimalWeight: mediumLeggingsOptWeight
  };

  const baseSum =
    weightAt(mediumChestplate.minOre, lightHelmetCurve) +
    weightAt(mediumChestplate.minOre, lightLeggingsCurve) +
    weightAt(mediumChestplate.minOre, lightChestplateCurve) +
    weightAt(mediumChestplate.minOre, mediumHelmetCurve) +
    weightAt(mediumChestplate.minOre, mediumLeggingsCurve);

  const mediumChestplateOptWeight = solveBisection((guess) => {
    const wMc20 =
      mediumChestplateMinWeight +
      ((heavyHelmet.minOre - mediumChestplate.minOre) /
        (mediumChestplate.optimalOre - mediumChestplate.minOre)) *
        (guess - mediumChestplateMinWeight);
    const wHhMin = ratioFromChance(heavyHelmet.minChance) * (baseSum + wMc20);
    const totalAt25 = (baseSum + guess) / (1 - (heavyHelmet.optimalChance + heavyLeggings.minChance));
    const wHhOpt = heavyHelmet.optimalChance * totalAt25;
    const wHh21 = wHhMin + ((mediumChestplate.optimalOre - heavyHelmet.minOre) / (heavyHelmet.optimalOre - heavyHelmet.minOre)) * (wHhOpt - wHhMin);
    const expected = ratioFromChance(mediumChestplate.optimalChance) * (baseSum + wHh21);
    return expected - guess;
  }, mediumChestplateMinWeight, mediumChestplateMinWeight * 1000);

  const mediumChestplateCurve: WeightCurve = {
    minOre: mediumChestplate.minOre,
    optimalOre: mediumChestplate.optimalOre,
    minWeight: mediumChestplateMinWeight,
    optimalWeight: mediumChestplateOptWeight
  };

  const heavyHelmetMinWeight = ratioFromChance(heavyHelmet.minChance) * (baseSum + weightAt(heavyHelmet.minOre, mediumChestplateCurve));
  const totalAt25 = (baseSum + mediumChestplateOptWeight) / (1 - (heavyHelmet.optimalChance + heavyLeggings.minChance));
  const heavyHelmetOptWeight = heavyHelmet.optimalChance * totalAt25;
  const heavyLeggingsMinWeight = heavyLeggings.minChance * totalAt25;
  const heavyHelmetCurve: WeightCurve = {
    minOre: heavyHelmet.minOre,
    optimalOre: heavyHelmet.optimalOre,
    minWeight: heavyHelmetMinWeight,
    optimalWeight: heavyHelmetOptWeight
  };

  const totalAt30 = (baseSum + mediumChestplateOptWeight + heavyHelmetOptWeight) / (1 - (heavyLeggings.optimalChance + heavyChestplate.minChance));
  const heavyLeggingsOptWeight = heavyLeggings.optimalChance * totalAt30;
  const heavyChestplateMinWeight = heavyChestplate.minChance * totalAt30;
  const heavyLeggingsCurve: WeightCurve = {
    minOre: heavyLeggings.minOre,
    optimalOre: heavyLeggings.optimalOre,
    minWeight: heavyLeggingsMinWeight,
    optimalWeight: heavyLeggingsOptWeight
  };

  const totalAt40 =
    (baseSum + mediumChestplateOptWeight + heavyHelmetOptWeight + heavyLeggingsOptWeight) / (1 - heavyChestplate.optimalChance);
  const heavyChestplateOptWeight = heavyChestplate.optimalChance * totalAt40;
  const heavyChestplateCurve: WeightCurve = {
    minOre: heavyChestplate.minOre,
    optimalOre: heavyChestplate.optimalOre,
    minWeight: heavyChestplateMinWeight,
    optimalWeight: heavyChestplateOptWeight
  };

  return {
    "Light-Helmet": lightHelmetCurve,
    "Light-Leggings": lightLeggingsCurve,
    "Light-Chestplate": lightChestplateCurve,
    "Medium-Helmet": mediumHelmetCurve,
    "Medium-Leggings": mediumLeggingsCurve,
    "Medium-Chestplate": mediumChestplateCurve,
    "Heavy-Helmet": heavyHelmetCurve,
    "Heavy-Leggings": heavyLeggingsCurve,
    "Heavy-Chestplate": heavyChestplateCurve
  };
}

const WEAPON_CLASS_WEIGHT_CURVES = buildWeaponClassWeightCurves();
const ARMOR_PIECE_WEIGHT_CURVES = buildArmorPieceWeightCurves();

function getArmorAnchorKey(weightGroup: ArmorWeightGroup, slot: ArmorSlot): ArmorPieceAnchorKey {
  return `${weightGroup}-${slot}`;
}

export function calculateWeaponClassProbabilities(totalCount: number): WeaponClassProbability[] {
  const entries = (Object.keys(WEAPON_CLASS_ANCHORS) as WeaponClass[]).map((weaponClass) => {
    const anchor = WEAPON_CLASS_ANCHORS[weaponClass];
    const curve = WEAPON_CLASS_WEIGHT_CURVES[weaponClass];
    return {
      class: weaponClass,
      weight: weightAt(totalCount, curve),
      probability: 0,
      minOre: anchor.minOre,
      optimalOre: anchor.optimalOre,
      minChance: anchor.minChance,
      optimalChance: anchor.optimalChance
    };
  });

  return normalizeWeights(entries);
}

export function calculateArmorPieceProbabilities(totalCount: number): ArmorPieceProbability[] {
  const entries = (Object.keys(ARMOR_PIECE_ANCHORS) as ArmorPieceAnchorKey[]).map((key) => {
    const anchor = ARMOR_PIECE_ANCHORS[key];
    const curve = ARMOR_PIECE_WEIGHT_CURVES[key];
    const [weightGroup, slot] = key.split("-") as [ArmorWeightGroup, ArmorSlot];
    return {
      key,
      weightGroup,
      slot,
      weight: weightAt(totalCount, curve),
      probability: 0,
      minOre: anchor.minOre,
      optimalOre: anchor.optimalOre,
      minChance: anchor.minChance,
      optimalChance: anchor.optimalChance
    };
  });

  return normalizeWeights(entries);
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
  multiplier: number,
  qualityMultiplier = 1
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
        finalDamage: item.baseDamage * multiplier * qualityMultiplier
      });
    });
  });

  return { classProbabilities, weapons };
}

export function calculateArmorOutcomes(
  totalCount: number,
  multiplier: number,
  qualityMultiplier = 1
): { pieceProbabilities: ArmorPieceProbability[]; armor: ArmorOutcome[] } {
  const pieceProbabilities = calculateArmorPieceProbabilities(totalCount);
  const armor: ArmorOutcome[] = [];
  const probabilityByKey = new Map(pieceProbabilities.map((entry) => [entry.key, entry.probability]));

  const piecesByKey = new Map<ArmorPieceAnchorKey, ArmorPiece[]>();
  ARMOR_PIECES.forEach((piece) => {
    const key = getArmorAnchorKey(piece.baseWeightGroup, piece.slot);
    const existing = piecesByKey.get(key);
    if (existing) {
      existing.push(piece);
    } else {
      piecesByKey.set(key, [piece]);
    }
  });

  pieceProbabilities.forEach((groupEntry) => {
    const items = piecesByKey.get(groupEntry.key) ?? [];
    const weightedItems = normalizeInternalWeights(items);
    const groupProbability = probabilityByKey.get(groupEntry.key) ?? 0;

    weightedItems.forEach((item) => {
      armor.push({
        armor: item,
        anchorKey: groupEntry.key,
        groupProbability,
        probability: groupProbability * item.normalized,
        finalHealthPercent: item.baseHealthPercent * multiplier * qualityMultiplier
      });
    });
  });

  return { pieceProbabilities, armor };
}

export function clampTotalCount(totalCount: number): number {
  return totalCount;
}

export function getOreComposition(usages: OreUsage[]): Array<{ ore: Ore; share: number; count: number }> {
  return usages
    .map(({ ore, share, count }) => ({ ore, share, count }))
    .sort((a, b) => b.share - a.share);
}
