'use client';

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type { ArmorPiece, Ore, Weapon } from "@/lib/forge/data";
import { optimizeInventory, type InventoryEntry, type ItemSuggestion, type OptimizationGoal } from "@/lib/forge/inventory-optimizer";

export function ForgeInventoryOptimizerClient({
    ores,
    weapons,
    armorPieces
}: {
    ores: Ore[];
    weapons: Weapon[];
    armorPieces: ArmorPiece[];
}) {
    const [inventory, setInventory] = useState<Record<string, number>>({});
    const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>("all_items");
    const [searchTerm, setSearchTerm] = useState("");
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Load inventory from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("forge-inventory-optimizer-inventory");
            if (saved) {
                const parsed = JSON.parse(saved);
                setInventory(parsed);
                setLastSaved(new Date());
            }
        } catch (error) {
            console.error("Failed to load saved inventory:", error);
        }
    }, []);

    // Save inventory to localStorage whenever it changes
    useEffect(() => {
        if (Object.keys(inventory).length > 0) {
            try {
                localStorage.setItem("forge-inventory-optimizer-inventory", JSON.stringify(inventory));
                setLastSaved(new Date());
            } catch (error) {
                console.error("Failed to save inventory:", error);
            }
        }
    }, [inventory]);

    const oresById = useMemo(() => {
        const map: Record<string, Ore> = {};
        ores.forEach((ore) => {
            map[ore.id] = ore;
        });
        return map;
    }, [ores]);

    const inventoryEntries: InventoryEntry[] = useMemo(() => {
        return Object.entries(inventory)
            .filter(([_, quantity]) => quantity > 0)
            .map(([oreId, quantity]) => ({
                oreId,
                quantity,
                lastUpdated: new Date()
            }));
    }, [inventory]);

    const totalOresInInventory = useMemo(() => {
        return Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
    }, [inventory]);

    // Auto-generate suggestions when inventory or goal changes
    const suggestions = useMemo(() => {
        if (inventoryEntries.length === 0) return [];
        return optimizeInventory(inventoryEntries, oresById, optimizationGoal, weapons, armorPieces);
    }, [inventoryEntries, oresById, optimizationGoal, weapons, armorPieces]);

    // Track when suggestions are generated
    useEffect(() => {
        if (suggestions.length > 0 && inventoryEntries.length > 0) {
            trackEvent("forge_inventory_optimize_auto", {
                goal: optimizationGoal,
                totalOres: totalOresInInventory,
                uniqueOres: inventoryEntries.length,
                suggestionsCount: suggestions.length
            });
        }
    }, [suggestions.length, optimizationGoal, totalOresInInventory, inventoryEntries.length]);

    const filteredOres = useMemo(() => {
        if (!searchTerm) return ores;
        const search = searchTerm.toLowerCase();
        return ores.filter(ore =>
            ore.name.toLowerCase().includes(search) ||
            ore.rarity.toLowerCase().includes(search) ||
            ore.areaGroup.toLowerCase().includes(search)
        );
    }, [ores, searchTerm]);

    const groupedOres = useMemo(() => {
        const groups: Record<string, Ore[]> = {};
        filteredOres.forEach((ore) => {
            if (!groups[ore.rarity]) groups[ore.rarity] = [];
            groups[ore.rarity].push(ore);
        });
        return groups;
    }, [filteredOres]);

    const updateInventory = (oreId: string, value: string) => {
        const quantity = Math.max(0, parseInt(value) || 0);
        setInventory(prev => ({
            ...prev,
            [oreId]: quantity
        }));
    };

    const clearInventory = () => {
        setInventory({});
        setLastSaved(null);
        try {
            localStorage.removeItem("forge-inventory-optimizer-inventory");
        } catch (error) {
            console.error("Failed to clear saved inventory:", error);
        }
        trackEvent("forge_inventory_clear");
    };

    const importInventory = () => {
        const input = prompt("Paste your inventory data (JSON format):");
        if (!input) return;

        try {
            const data = JSON.parse(input);
            setInventory(data);
            trackEvent("forge_inventory_import", { oresImported: Object.keys(data).length });
        } catch (error) {
            alert("Invalid JSON format. Please check your data and try again.");
        }
    };

    const exportInventory = () => {
        const data = JSON.stringify(inventory, null, 2);
        navigator.clipboard.writeText(data);
        alert("Inventory copied to clipboard!");
        trackEvent("forge_inventory_export", { oresExported: Object.keys(inventory).length });
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
                {/* Optimization Goal */}
                <div className="panel p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-semibold text-foreground mb-2">Optimization Goal</label>
                            <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
                                <button
                                    type="button"
                                    onClick={() => setOptimizationGoal("weapon_focus")}
                                    className={cn(
                                        "px-4 py-2 transition",
                                        optimizationGoal === "weapon_focus" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
                                    )}
                                >
                                    Weapon Focus
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOptimizationGoal("armor_focus")}
                                    className={cn(
                                        "px-4 py-2 transition",
                                        optimizationGoal === "armor_focus" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
                                    )}
                                >
                                    Armor Focus
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOptimizationGoal("all_items")}
                                    className={cn(
                                        "px-4 py-2 transition",
                                        optimizationGoal === "all_items" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
                                    )}
                                >
                                    All Items
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOptimizationGoal("common_ores")}
                                    className={cn(
                                        "px-4 py-2 transition",
                                        optimizationGoal === "common_ores" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
                                    )}
                                >
                                    Common Ores
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOptimizationGoal("trait_priority")}
                                    className={cn(
                                        "px-4 py-2 transition",
                                        optimizationGoal === "trait_priority" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
                                    )}
                                >
                                    Trait Priority
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={importInventory}
                                className="px-4 py-2 rounded-lg border border-border/60 bg-surface text-sm font-semibold text-foreground hover:bg-surface-muted transition"
                            >
                                Import
                            </button>
                            <button
                                onClick={exportInventory}
                                disabled={inventoryEntries.length === 0}
                                className={cn(
                                    "px-4 py-2 rounded-lg border border-border/60 bg-surface text-sm font-semibold text-foreground hover:bg-surface-muted transition",
                                    inventoryEntries.length === 0 && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                Export
                            </button>
                            <button
                                onClick={clearInventory}
                                disabled={inventoryEntries.length === 0}
                                className={cn(
                                    "px-4 py-2 rounded-lg bg-red-500/10 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition",
                                    inventoryEntries.length === 0 && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-muted">Inventory:</span>
                            <span className="font-semibold text-foreground">{inventoryEntries.length} types</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted">Total ores:</span>
                            <span className="font-semibold text-foreground">{totalOresInInventory}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted">Suggestions:</span>
                            <span className="font-semibold text-accent">{suggestions.length}</span>
                        </div>
                        {lastSaved && inventoryEntries.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-green-600 dark:text-green-400">✓</span>
                                <span className="text-muted">Auto-saved</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Build Your Inventory */}
                <div className="panel p-4 space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Your Inventory</h3>

                    <input
                        type="search"
                        placeholder="Search by ore name, rarity, or region..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-border/60 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />

                    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
                        {["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Divine", "Relic", "Exotic"].map((rarity) => {
                            const oresInRarity = groupedOres[rarity];
                            if (!oresInRarity || oresInRarity.length === 0) return null;

                            return (
                                <div key={rarity} className="space-y-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{rarity}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {oresInRarity.map((ore) => (
                                            <div
                                                key={ore.id}
                                                className={cn(
                                                    "rounded-lg border bg-surface p-2 space-y-2 transition",
                                                    inventory[ore.id] > 0 ? "border-accent ring-1 ring-accent/40" : "border-border/60"
                                                )}
                                            >
                                                {ore.imageUrl && (
                                                    <div className="flex justify-center">
                                                        <div className="h-10 w-10 rounded bg-surface-muted overflow-hidden">
                                                            <Image
                                                                src={ore.imageUrl}
                                                                alt={ore.name}
                                                                width={40}
                                                                height={40}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <p className="text-xs font-semibold text-foreground text-center truncate">{ore.name}</p>
                                                <p className="text-[10px] text-muted text-center">{ore.multiplier.toFixed(2)}x</p>
                                                <div className="flex items-stretch rounded-md border border-border/60 overflow-hidden bg-background transition-all focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = inventory[ore.id] || 0;
                                                            if (current > 0) {
                                                                updateInventory(ore.id, String(current - 1));
                                                            }
                                                        }}
                                                        disabled={!inventory[ore.id] || inventory[ore.id] === 0}
                                                        className={cn(
                                                            "w-7 h-7 flex items-center justify-center text-base font-bold transition-colors border-r border-border/40",
                                                            (!inventory[ore.id] || inventory[ore.id] === 0)
                                                                ? "text-muted/40 cursor-not-allowed bg-surface/50"
                                                                : "text-foreground hover:bg-accent hover:text-white active:bg-accent-dark"
                                                        )}
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        value={inventory[ore.id] || ""}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            if (value === "" || /^\d+$/.test(value)) {
                                                                updateInventory(ore.id, value);
                                                            }
                                                        }}
                                                        placeholder="0"
                                                        className="flex-1 h-7 min-w-0 px-2 bg-transparent text-foreground text-sm font-semibold text-center focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = inventory[ore.id] || 0;
                                                            updateInventory(ore.id, String(current + 1));
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center text-base font-bold text-foreground transition-colors border-l border-border/40 hover:bg-accent hover:text-white active:bg-accent-dark"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right Panel - 1/3 width */}
            <div className="lg:col-span-1">
                <div className="panel p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Best Crafts</h2>
                    <p className="text-xs text-muted mb-4">
                        {inventoryEntries.length > 0 ? `Top ${suggestions.length} recommendations · ${optimizationGoal.replace(/_/g, " ")}` : "Add ores to get suggestions"}
                    </p>

                    {inventoryEntries.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-5xl mb-4">⚒️</div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">No Inventory</h3>
                            <p className="text-xs text-muted">
                                Add ores to your inventory to get crafting suggestions
                            </p>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-sm text-muted">Calculating best crafts...</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {suggestions.map((suggestion, idx) => {
                                const isWeapon = suggestion.itemType === "weapon";
                                const item = suggestion.item as (Weapon | ArmorPiece);
                                const weapon = isWeapon ? (item as Weapon) : null;
                                const armor = !isWeapon ? (item as ArmorPiece) : null;

                                return (
                                    <div
                                        key={idx}
                                        className="rounded-lg border border-border/60 bg-gradient-to-br from-surface to-surface/50 p-3 space-y-2.5 hover:border-accent/50 transition"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{isWeapon ? "⚔️" : "🛡️"}</span>
                                                    <h4 className="text-sm font-bold text-foreground truncate">
                                                        {item.name}
                                                    </h4>
                                                </div>
                                                <p className="text-[10px] text-muted">
                                                    {isWeapon ? weapon?.class : armor?.slot}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-[10px] font-bold text-accent whitespace-nowrap block">
                                                    {(suggestion.probability * 100).toFixed(1)}%
                                                </span>
                                                <span className="text-[9px] text-muted">chance</span>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                                            <div className="text-center p-1.5 rounded bg-background/50">
                                                <p className="text-muted mb-0.5">{isWeapon ? "Damage" : "Health"}</p>
                                                <p className="font-bold text-accent">
                                                    {suggestion.metrics.expectedStat.toFixed(1)}{isWeapon ? "" : "%"}
                                                </p>
                                            </div>
                                            <div className="text-center p-1.5 rounded bg-background/50">
                                                <p className="text-muted mb-0.5">Multiplier</p>
                                                <p className="font-semibold text-foreground">
                                                    {suggestion.metrics.totalMultiplier.toFixed(2)}x
                                                </p>
                                            </div>
                                            <div className="text-center p-1.5 rounded bg-background/50">
                                                <p className="text-muted mb-0.5">Traits</p>
                                                <p className="font-semibold text-foreground">
                                                    {suggestion.metrics.activeTraits}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Ore Recipe */}
                                        <div className="pt-2 border-t border-border/40">
                                            <p className="text-[9px] uppercase tracking-wide text-muted font-semibold mb-1.5">
                                                Ore Recipe ({suggestion.oreComposition.reduce((sum, s) => sum + s.count, 0)} total)
                                            </p>
                                            <div className="grid grid-cols-2 gap-1">
                                                {suggestion.oreComposition.map((sel) => {
                                                    const ore = oresById[sel.oreId];
                                                    if (!ore) return null;
                                                    return (
                                                        <div key={sel.oreId} className="flex items-center gap-1.5 p-1 rounded bg-background/30">
                                                            {ore.imageUrl && (
                                                                <div className="h-3 w-3 rounded bg-surface overflow-hidden flex-shrink-0">
                                                                    <Image
                                                                        src={ore.imageUrl}
                                                                        alt={ore.name}
                                                                        width={12}
                                                                        height={12}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </div>
                                                            )}
                                                            <span className="text-[9px] text-foreground truncate flex-1">{ore.name}</span>
                                                            <span className="text-[9px] font-bold text-muted">×{sel.count}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Rank Badge */}
                                        {idx < 3 && (
                                            <div className="flex items-center justify-between text-[9px] pt-1">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded font-bold uppercase",
                                                    idx === 0 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                                                        idx === 1 ? "bg-gray-400/20 text-gray-600 dark:text-gray-400" :
                                                            "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                                                )}>
                                                    {idx === 0 ? "🥇 Top Pick" : idx === 1 ? "🥈 2nd Best" : "🥉 3rd Best"}
                                                </span>
                                                <span className="text-muted">Uses: {suggestion.metrics.totalOres} ores</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
