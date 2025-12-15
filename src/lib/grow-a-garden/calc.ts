import {
  GAG_FUSIONS,
  GAG_MUTATIONS,
  GAG_UI_RULES,
  GAG_VARIANTS,
  type FusionRule,
  type Mutation,
  type Variant
} from "./mutations";
import type { CropRecord } from "./crops";

export type CalculationInput = {
  crop: CropRecord;
  weightKg: number;
  quantity: number;
  variantName: string;
  mutationNames: string[];
};

export type CalculationResult = {
  total: number;
  perCrop: number;
  weightFactor: number;
  baseValue: number;
  baseWeightKg: number;
  variantMultiplier: number;
  mutationMultiplier: number;
  appliedMutations: Mutation[];
  skippedMutations: Mutation[]; // missing multipliers
};

const mutationMap = new Map(GAG_MUTATIONS.map((m) => [m.name, m]));
const variantMap = new Map(GAG_VARIANTS.map((v) => [v.name, v]));

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function resolveVariant(name: string): Variant {
  return variantMap.get(name) ?? GAG_VARIANTS[0];
}

function conflictsFor(name: string): string[] {
  const mut = mutationMap.get(name);
  return mut?.conflicts ?? [];
}

function stripConflicts(selected: Set<string>): Set<string> {
  const result = new Set<string>(selected);
  selected.forEach((name) => {
    conflictsFor(name).forEach((conflict) => {
      if (conflict !== name && result.has(conflict)) {
        result.delete(conflict);
      }
    });
  });
  return result;
}

function componentsSatisfied(rule: FusionRule, selected: Set<string>): boolean {
  const all = rule.madeFrom.every((name) => selected.has(name));
  const alt = rule.madeFromAlt ? rule.madeFromAlt.every((name) => selected.has(name)) : false;
  return all || alt;
}

function applyFusionUpgrades(selected: Set<string>): Set<string> {
  if (!GAG_UI_RULES.autoUpgradeToFusion) return selected;
  let changed = true;
  const current = new Set(selected);

  while (changed) {
    changed = false;
    for (const rule of GAG_FUSIONS) {
      const hasFusion = current.has(rule.name);
      const hasComponents = componentsSatisfied(rule, current);
      if (!hasComponents && !hasFusion) continue;

      if (hasFusion && GAG_UI_RULES.whenFusionSelectedRemoveComponents) {
        rule.madeFrom.forEach((name) => current.delete(name));
        rule.madeFromAlt?.forEach((name) => current.delete(name));
        continue;
      }

      if (hasComponents && !hasFusion) {
        current.add(rule.name);
        if (GAG_UI_RULES.whenFusionSelectedRemoveComponents) {
          rule.madeFrom.forEach((name) => current.delete(name));
          rule.madeFromAlt?.forEach((name) => current.delete(name));
        }
        changed = true;
      }
    }
  }

  return current;
}

export function normalizeMutations(selectedNames: string[]): { names: string[] } {
  const unique = new Set(uniqueList(selectedNames));
  const withFusions = applyFusionUpgrades(unique);
  const conflictResolved = stripConflicts(withFusions);
  return { names: Array.from(conflictResolved) };
}

function mutationMultiplier(selectedNames: string[]): {
  multiplier: number;
  applied: Mutation[];
  skipped: Mutation[];
} {
  let sum = 0;
  let count = 0;
  const applied: Mutation[] = [];
  const skipped: Mutation[] = [];

  selectedNames.forEach((name) => {
    const mut = mutationMap.get(name);
    if (!mut) return;
    if (mut.multiplier === null) {
      skipped.push(mut);
      return;
    }
    sum += mut.multiplier;
    count += 1;
    applied.push(mut);
  });

  const multiplier = 1 + sum - count;
  return { multiplier, applied, skipped };
}

export function computeCalculation(input: CalculationInput): CalculationResult {
  const { crop, weightKg, quantity, variantName, mutationNames } = input;

  const safeWeight = Math.max(weightKg, 0);
  const safeQuantity = Math.max(Math.floor(quantity) || 1, 1);
  const variant = resolveVariant(variantName);
  const normalizedMutations = normalizeMutations(mutationNames);
  const { multiplier: mutationMulti, applied, skipped } = mutationMultiplier(normalizedMutations.names);

  const baseWeight = crop.baseWeightKg || 1;
  const weightFactor = Math.pow(safeWeight / baseWeight, 2);

  const cropValue = crop.baseValue * weightFactor;
  const variantMultiplier = variant.multiplier;
  const totalMultiplier = variantMultiplier * mutationMulti;
  const total = cropValue * totalMultiplier * safeQuantity;

  return {
    total,
    perCrop: total / safeQuantity,
    weightFactor,
    baseValue: crop.baseValue,
    baseWeightKg: baseWeight,
    variantMultiplier,
    mutationMultiplier: mutationMulti,
    appliedMutations: applied,
    skippedMutations: skipped
  };
}
