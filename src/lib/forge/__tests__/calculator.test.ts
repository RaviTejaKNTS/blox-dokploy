import { describe, expect, it } from "vitest";
import {
  aggregateOreSelections,
  calculateArmorPieceProbabilities,
  calculateTotalMultiplier,
  calculateTraitActivations,
  calculateWeaponClassProbabilities
} from "../calculator";

function expectWithin(actual: number, expected: number, tolerance = 0.005) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("forge calculator", () => {
  it("calculates weighted multiplier by ore count", () => {
    const { usages, totalCount } = aggregateOreSelections([
      { oreId: "stone", count: 2 },
      { oreId: "iron", count: 1 }
    ]);

    const multiplier = calculateTotalMultiplier(usages, totalCount);
    expectWithin(multiplier, 0.25, 1e-6);
  });

  it("activates traits at 10% (minor) and 30% (full)", () => {
    const minorMix = aggregateOreSelections([
      { oreId: "poopite", count: 1 },
      { oreId: "stone", count: 9 }
    ]);
    const minorTraits = calculateTraitActivations(minorMix.usages, minorMix.totalCount);
    expect(minorTraits).toHaveLength(1);
    expect(minorTraits[0].tier).toBe("minor");

    const fullMix = aggregateOreSelections([
      { oreId: "poopite", count: 3 },
      { oreId: "stone", count: 7 }
    ]);
    const fullTraits = calculateTraitActivations(fullMix.usages, fullMix.totalCount);
    expect(fullTraits).toHaveLength(1);
    expect(fullTraits[0].tier).toBe("full");

    const inactiveMix = aggregateOreSelections([
      { oreId: "poopite", count: 1 },
      { oreId: "stone", count: 10 }
    ]);
    const inactiveTraits = calculateTraitActivations(inactiveMix.usages, inactiveMix.totalCount);
    expect(inactiveTraits).toHaveLength(0);
  });

  it("matches weapon class anchor probabilities for Straight Sword", () => {
    const atMin = calculateWeaponClassProbabilities(4);
    const straightMin = atMin.find((entry) => entry.class === "Straight Sword");
    expect(straightMin).toBeDefined();
    expectWithin(straightMin?.probability ?? 0, 0.14);

    const atOpt = calculateWeaponClassProbabilities(6);
    const straightOpt = atOpt.find((entry) => entry.class === "Straight Sword");
    expect(straightOpt).toBeDefined();
    expectWithin(straightOpt?.probability ?? 0, 0.86);
  });

  it("matches armor piece anchor probabilities for Light Helmet", () => {
    const atMin = calculateArmorPieceProbabilities(3);
    const lightHelmet = atMin.find((entry) => entry.key === "Light-Helmet");
    expect(lightHelmet).toBeDefined();
    expectWithin(lightHelmet?.probability ?? 0, 1, 1e-6);
  });

  it("matches armor piece anchor probabilities for Light Leggings", () => {
    const atMin = calculateArmorPieceProbabilities(5);
    const lightLeggings = atMin.find((entry) => entry.key === "Light-Leggings");
    expect(lightLeggings).toBeDefined();
    expectWithin(lightLeggings?.probability ?? 0, 0.11);
  });
});
