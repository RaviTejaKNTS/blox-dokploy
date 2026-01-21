import type { Ore, Weapon, ArmorPiece } from "./data";
import {
    calculateTotalMultiplier,
    calculateTraitActivations,
    calculateWeaponOutcomes,
    calculateArmorOutcomes,
    aggregateOreSelections,
    type OreSelection,
    type WeaponOutcome,
    type ArmorOutcome
} from "./calculator";

export type InventoryEntry = {
    oreId: string;
    quantity: number;
    lastUpdated: Date;
};

export type OptimizationGoal = "weapon_focus" | "armor_focus" | "all_items" | "common_ores" | "trait_priority";

export type ItemSuggestion = {
    itemType: "weapon" | "armor";
    item: Weapon | ArmorPiece;
    oreComposition: OreSelection[];
    probability: number;
    metrics: {
        totalMultiplier: number;
        activeTraits: number;
        totalOres: number;
        expectedStat: number; // damage for weapons, health% for armor
    };
    rank: number;
};

// Rarity tier mapping for common ore filtering
const COMMON_RARITIES = ["Common", "Uncommon", "Rare"];

/**
 * Optimize inventory to get best craftable items
 */
export function optimizeInventory(
    inventory: InventoryEntry[],
    oresById: Record<string, Ore>,
    goal: OptimizationGoal,
    weapons: Weapon[],
    armorPieces: ArmorPiece[]
): ItemSuggestion[] {
    if (inventory.length === 0) return [];

    const suggestions: ItemSuggestion[] = [];

    if (goal === "weapon_focus" || goal === "all_items" || goal === "common_ores" || goal === "trait_priority") {
        // Focus on weapons
        const weaponSuggestions = generateWeaponSuggestions(inventory, oresById, goal, weapons);
        suggestions.push(...weaponSuggestions);
    }

    if (goal === "armor_focus" || goal === "all_items") {
        // Focus on armor
        const armorSuggestions = generateArmorSuggestions(inventory, oresById, goal, armorPieces);
        suggestions.push(...armorSuggestions);
    }

    // Rank suggestions based on player priorities (no limit - show all viable options)
    return suggestions
        .sort((a, b) => rankSuggestion(b, goal) - rankSuggestion(a, goal))
        .map((s, idx) => ({ ...s, rank: idx + 1 }));
}

/**
 * Generate weapon suggestions from inventory
 */
function generateWeaponSuggestions(
    inventory: InventoryEntry[],
    oresById: Record<string, Ore>,
    goal: OptimizationGoal,
    weapons: Weapon[]
): ItemSuggestion[] {
    const suggestions: ItemSuggestion[] = [];

    // Generate different ore combinations
    const combinations = generateOreCombinations(inventory, oresById, goal);

    for (const combo of combinations) {
        const { usages, totalCount } = aggregateOreSelections(combo, oresById);
        if (totalCount < 3) continue; // Min 3 ores required

        const multiplier = calculateTotalMultiplier(usages, totalCount);
        const traits = calculateTraitActivations(usages, totalCount);
        const weaponOutcomes = calculateWeaponOutcomes(totalCount, multiplier, 1, weapons);

        // Get top weapons from this combination
        const topWeapons = weaponOutcomes.weapons
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5); // Top 5 weapons

        for (const outcome of topWeapons) {
            if (outcome.probability < 0.01) continue; // Skip if less than 1% chance

            const totalOres = combo.reduce((sum, sel) => sum + sel.count, 0);

            suggestions.push({
                itemType: "weapon",
                item: outcome.weapon,
                oreComposition: combo,
                probability: outcome.probability,
                metrics: {
                    totalMultiplier: multiplier,
                    activeTraits: traits.length,
                    totalOres,
                    expectedStat: outcome.finalDamage
                },
                rank: 0
            });
        }
    }

    return suggestions;
}

/**
 * Generate armor suggestions from inventory
 */
function generateArmorSuggestions(
    inventory: InventoryEntry[],
    oresById: Record<string, Ore>,
    goal: OptimizationGoal,
    armorPieces: ArmorPiece[]
): ItemSuggestion[] {
    const suggestions: ItemSuggestion[] = [];

    // Generate different ore combinations
    const combinations = generateOreCombinations(inventory, oresById, goal);

    for (const combo of combinations) {
        const { usages, totalCount } = aggregateOreSelections(combo, oresById);
        if (totalCount < 3) continue;

        const multiplier = calculateTotalMultiplier(usages, totalCount);
        const traits = calculateTraitActivations(usages, totalCount);
        const armorOutcomes = calculateArmorOutcomes(totalCount, multiplier, 1, armorPieces);

        // Get top armor from this combination
        const topArmor = armorOutcomes.armor
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5);

        for (const outcome of topArmor) {
            if (outcome.probability < 0.01) continue;

            const totalOres = combo.reduce((sum, sel) => sum + sel.count, 0);

            suggestions.push({
                itemType: "armor",
                item: outcome.armor,
                oreComposition: combo,
                probability: outcome.probability,
                metrics: {
                    totalMultiplier: multiplier,
                    activeTraits: traits.length,
                    totalOres,
                    expectedStat: outcome.finalHealthPercent
                },
                rank: 0
            });
        }
    }

    return suggestions;
}

/**
 * Generate strategic ore combinations from inventory
 * Based on actual game ore requirements for different item types
 */
function generateOreCombinations(
    inventory: InventoryEntry[],
    oresById: Record<string, Ore>,
    goal: OptimizationGoal
): OreSelection[][] {
    const combinations: OreSelection[][] = [];

    // Sort ores by multiplier
    const sortedOres = inventory
        .map(entry => ({ entry, ore: oresById[entry.oreId] }))
        .filter(item => item.ore)
        .sort((a, b) => (b.ore?.multiplier || 0) - (a.ore?.multiplier || 0));

    if (sortedOres.length === 0) return [];

    // Filter for common ores only if that's the goal
    const availableOres = goal === "common_ores"
        ? sortedOres.filter(item => item.ore && COMMON_RARITIES.includes(item.ore.rarity))
        : sortedOres;

    if (availableOres.length === 0) return [];

    // Filter for trait ores if that's the priority
    const traitOres = availableOres.filter(item => item.ore?.hasTrait);

    // Ore count thresholds for different item types (based on game mechanics)
    // Weapons: 3 (dagger), 6 (straight sword), 9 (gauntlets/mace), 12 (katana/axe), 16 (great sword/spear)
    // Armor: 3 (light helmet), 7-10 (light pieces), 17 (medium), 30-35 (heavy)
    const oreThresholds = [3, 6, 9, 12, 16, 20, 30, 40, 50];

    // Generate combinations for each ore threshold
    for (const targetCount of oreThresholds) {
        // Strategy 1: Pure single ore (highest multiplier)
        if (availableOres.length >= 1) {
            const best = availableOres[0];
            const available = Math.min(best.entry.quantity, targetCount);
            if (available >= 3) {
                combinations.push([{ oreId: best.entry.oreId, count: Math.min(available, targetCount) }]);
            }
        }

        // Strategy 2: Mix of top 2 ores (70/30 split for better multiplier balance)
        if (availableOres.length >= 2 && targetCount >= 6) {
            const first = availableOres[0];
            const second = availableOres[1];
            const firstCount = Math.min(first.entry.quantity, Math.floor(targetCount * 0.7));
            const secondCount = Math.min(second.entry.quantity, Math.ceil(targetCount * 0.3));

            if (firstCount + secondCount >= 3) {
                combinations.push([
                    { oreId: first.entry.oreId, count: firstCount },
                    { oreId: second.entry.oreId, count: secondCount }
                ]);
            }
        }

        // Strategy 3: Trait-focused (30% threshold for full trait activation)
        if (traitOres.length >= 1 && targetCount >= 10) {
            const traitOre = traitOres[0];
            const traitCount = Math.min(traitOre.entry.quantity, Math.ceil(targetCount * 0.3)); // 30% for full trait

            if (availableOres.length >= 2) {
                const filler = availableOres.find(o => o.entry.oreId !== traitOre.entry.oreId);
                if (filler) {
                    const fillerCount = Math.min(filler.entry.quantity, targetCount - traitCount);
                    if (traitCount + fillerCount >= 3) {
                        combinations.push([
                            { oreId: traitOre.entry.oreId, count: traitCount },
                            { oreId: filler.entry.oreId, count: fillerCount }
                        ]);
                    }
                }
            } else if (traitCount >= 3) {
                combinations.push([{ oreId: traitOre.entry.oreId, count: traitCount }]);
            }
        }

        // Strategy 4: Balanced 3-ore mix (equal distribution)
        if (availableOres.length >= 3 && targetCount >= 9) {
            const first = availableOres[0];
            const second = availableOres[1];
            const third = availableOres[2];
            const perOre = Math.floor(targetCount / 3);

            const firstCount = Math.min(first.entry.quantity, perOre);
            const secondCount = Math.min(second.entry.quantity, perOre);
            const thirdCount = Math.min(third.entry.quantity, perOre);

            if (firstCount + secondCount + thirdCount >= 3) {
                combinations.push([
                    { oreId: first.entry.oreId, count: firstCount },
                    { oreId: second.entry.oreId, count: secondCount },
                    { oreId: third.entry.oreId, count: thirdCount }
                ]);
            }
        }
    }

    // Remove duplicate combinations
    const uniqueCombos = new Map<string, OreSelection[]>();
    for (const combo of combinations) {
        const key = combo
            .sort((a, b) => a.oreId.localeCompare(b.oreId))
            .map(s => `${s.oreId}:${s.count}`)
            .join(',');
        if (!uniqueCombos.has(key)) {
            uniqueCombos.set(key, combo);
        }
    }

    return Array.from(uniqueCombos.values());
}

/**
 * Rank suggestion based on goal and player priorities
 * 
 * Research-Based Player Priorities:
 * 1. VALUE EFFICIENCY: Best output per ore invested (damage/ore or health/ore)
 * 2. SWEET SPOT ITEMS: High probability (>50%) + High damage = Best crafts
 * 3. TRAIT VALUE: Not just count, but actual meta-relevant traits
 * 4. CRAFTABILITY: Can they actually get this item? (probability)
 * 
 * Philosophy: Show BEST items first, not lowest-ore-count items
 */
function rankSuggestion(suggestion: ItemSuggestion, goal: OptimizationGoal): number {
    const prob = suggestion.probability;
    const mult = suggestion.metrics.totalMultiplier;
    const stat = suggestion.metrics.expectedStat;
    const traits = suggestion.metrics.activeTraits;
    const ores = suggestion.metrics.totalOres;

    // === Core Metrics ===

    // 1. VALUE EFFICIENCY: Stat output per ore (the holy grail metric)
    const valuePerOre = ores > 0 ? stat / ores : 0;

    // 2. PROBABILITY-WEIGHTED VALUE: What you actually expect to get
    const expectedValue = prob * stat * mult;

    // 3. EFFICIENCY RATIO: High-value items with reasonable ore investment
    // Rewards "sweet spot" items (e.g., 12-16 ore katanas/greatswords with 70%+ chance)
    const efficiencyRatio = ores > 0 ? expectedValue / ores : 0;

    // 4. TRAIT VALUE BONUS: Each trait is valuable, but more traits = exponentially better
    // 1 trait = 500, 2 traits = 1200, 3 traits = 2100 (non-linear scaling)
    const traitBonus = traits > 0 ? (traits * 400) + (traits * traits * 100) : 0;

    // 5. PROBABILITY MULTIPLIER: Heavily favor items you can actually craft
    // >80% = 3x, >50% = 2x, >30% = 1.5x, <30% = 1x
    const probMultiplier = prob > 0.8 ? 3 : prob > 0.5 ? 2 : prob > 0.3 ? 1.5 : 1;

    // 6. SWEET SPOT BONUS: Extra points for high-probability high-stat items
    // These are the "best crafts" - e.g., Katana at 12 ores (72% chance, great damage)
    const isSweetSpot = prob > 0.5 && stat > 1000 && ores >= 6 && ores <= 20;
    const sweetSpotBonus = isSweetSpot ? 10000 : 0;

    // === Goal-Specific Ranking ===

    switch (goal) {
        case "weapon_focus":
        case "armor_focus":
            // Priority: Sweet Spots > Value Efficiency > Traits > Expected Value
            // Show BEST items first (e.g., Katana/Greatsword > Dagger)
            return (sweetSpotBonus * 2)
                + (efficiencyRatio * 1000 * probMultiplier)
                + (valuePerOre * 500)
                + traitBonus
                + expectedValue;

        case "all_items":
            // Balanced: All factors considered equally
            return sweetSpotBonus
                + (efficiencyRatio * 800 * probMultiplier)
                + (valuePerOre * 400)
                + traitBonus
                + (expectedValue * 0.8);

        case "common_ores":
            // Priority: Maximize value from common ores (efficiency is king)
            // Heavy armor with common ores = best profit strategy
            return (efficiencyRatio * 1500 * probMultiplier)
                + (valuePerOre * 800)
                + sweetSpotBonus
                + (traitBonus * 0.3)
                + (expectedValue * 0.5);

        case "trait_priority":
            // Priority: Traits > Sweet Spots > Efficiency
            // For meta builds (crit, lifesteal, damage boost)
            return (traitBonus * 5)
                + (sweetSpotBonus * 1.5)
                + (efficiencyRatio * 500 * probMultiplier)
                + (expectedValue * 0.7);

        default:
            // Fallback: Efficiency × Probability
            return efficiencyRatio * probMultiplier * 1000;
    }
}
