'use client';

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ARMOR_SLOTS,
  MAX_ORE_TYPES,
  MAX_TOTAL_ORE_COUNT,
  MIN_TOTAL_ORE_COUNT,
  QUALITY_TIERS,
  type ArmorSlot,
  type Ore,
  type QualityTier,
  type TraitType
} from "@/lib/forge/data";
import {
  aggregateOreSelections,
  calculateArmorOutcomes,
  calculateTotalMultiplier,
  calculateTraitActivations,
  calculateWeaponOutcomes,
  getOreComposition,
  type OreSelection
} from "@/lib/forge/calculator";

type Mode = "weapon" | "armor";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function traitVisibleInMode(traitType: TraitType | null, mode: Mode): boolean {
  if (!traitType) return true; // default to showing if not tagged
  if (traitType === "both") return true;
  if (mode === "weapon") {
    return traitType === "weapon" || traitType === "weapon_aoe";
  }
  // armor mode
  return traitType === "armor" || traitType === "armor_aoe" || traitType === "armor_defense" || traitType === "movement";
}

function formatPercent(prob: number): string {
  const value = prob * 100;
  if (!Number.isFinite(value)) return "0%";
  if (value >= 10) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

function OreCard({
  ore,
  selected,
  count,
  onSelect
}: {
  ore: Ore;
  selected: boolean;
  count: number;
  onSelect: () => void;
}) {
  const image = ore.imageUrl;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full w-full min-h-[150px] flex-col justify-between overflow-hidden rounded-xl border bg-surface px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-soft",
        selected ? "border-accent/80 ring-2 ring-accent/40" : "border-border/70"
      )}
    >
      <div className="space-y-2">
        {image ? (
          <div className="flex justify-center">
            <div className="h-16 w-16 overflow-hidden rounded-lg bg-surface-muted">
              <Image src={image} alt={ore.name} width={64} height={64} className="h-full w-full object-cover" />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="break-words text-sm font-semibold leading-tight text-foreground">{ore.name}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
          {ore.multiplier.toFixed(2)}x
        </span>
        {selected ? (
          <span className="rounded-full bg-accent px-2 py-[2px] text-[11px] font-bold text-white shadow-soft dark:bg-accent-dark">
            x{count}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ProbabilityRow({
  label,
  probability,
  hint,
  children
}: {
  label: string;
  probability: number;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
        <span className="text-sm font-semibold text-foreground">{formatPercent(probability)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-surface-muted">
        <div
          className="h-2 rounded-full bg-accent transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, probability * 100))}%` }}
        />
      </div>
      {children ? <div className="mt-2 text-xs text-muted">{children}</div> : null}
    </div>
  );
}

function TraitPill({ ore, share, tier }: { ore: Ore; share: number; tier: "minor" | "full" }) {
  return (
    <div className="flex min-w-[240px] flex-col gap-1 rounded-xl border border-border/70 bg-surface px-3 py-2 text-xs text-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{ore.traitName ?? ore.name}</span>
        <span className="rounded-full bg-accent/10 px-2 py-[2px] text-[11px] font-bold uppercase tracking-wide text-accent">
          {tier === "full" ? "Full" : "Minor"} · {(share * 100).toFixed(1)}%
        </span>
      </div>
      <p className="text-[11px] text-muted">{ore.traitEffectShort ?? "Trait effect unknown."}</p>
    </div>
  );
}

export function ForgeCalculatorClient({ ores }: { ores: Ore[] }) {
  const [mode, setMode] = useState<Mode>("weapon");
  const [armorSlotFilter, setArmorSlotFilter] = useState<ArmorSlot | "All">("All");
  const [progression, setProgression] = useState<"Stonewake" | "Forgotten Kingdom">("Forgotten Kingdom");
  const [qualityTier, setQualityTier] = useState<QualityTier>("Standard");
  const [search, setSearch] = useState("");
  const [selectedOres, setSelectedOres] = useState<OreSelection[]>([
    { oreId: "diamond", count: 1 },
    { oreId: "sapphire", count: 2 }
  ]);

  const oresById = useMemo(() => {
    const map: Record<string, Ore> = {};
    ores.forEach((ore) => {
      map[ore.id] = ore;
    });
    return map;
  }, [ores]);

  const { usages, totalCount } = useMemo(
    () => aggregateOreSelections(selectedOres, oresById),
    [selectedOres, oresById]
  );
  const qualityOption = useMemo(
    () => QUALITY_TIERS.find((tier) => tier.tier === qualityTier) ?? QUALITY_TIERS[2],
    [qualityTier]
  );
  const qualityMultiplier = qualityOption?.multiplier ?? 1;
  const multiplier = useMemo(() => calculateTotalMultiplier(usages, totalCount), [usages, totalCount]);
  const traits = useMemo(() => calculateTraitActivations(usages, totalCount), [usages, totalCount]);
  const composition = useMemo(() => getOreComposition(usages), [usages]);
  const weaponResults = useMemo(
    () => calculateWeaponOutcomes(totalCount, multiplier, qualityMultiplier),
    [totalCount, multiplier, qualityMultiplier]
  );
  const armorResults = useMemo(
    () => calculateArmorOutcomes(totalCount, multiplier, qualityMultiplier),
    [totalCount, multiplier, qualityMultiplier]
  );

  const filteredOres = useMemo(
    () =>
      ores.filter(
        (ore) =>
          ore.name.toLowerCase().includes(search.toLowerCase()) ||
          ore.rarity.toLowerCase().includes(search.toLowerCase()) ||
          ore.areaGroup.toLowerCase().includes(search.toLowerCase())
      ),
    [ores, search]
  );

  const groupedByRarity = useMemo(() => {
    const groups: Record<string, Ore[]> = {};
    filteredOres.forEach((ore) => {
      if (!groups[ore.rarity]) groups[ore.rarity] = [];
      groups[ore.rarity].push(ore);
    });
    return groups;
  }, [filteredOres]);

  const filteredPieceProbabilities = useMemo(() => {
    return armorResults.pieceProbabilities.filter((entry) => {
      if (armorSlotFilter !== "All" && entry.slot !== armorSlotFilter) return false;
      if (progression === "Stonewake" && entry.weightGroup !== "Light") return false;
      return true;
    });
  }, [armorResults.pieceProbabilities, armorSlotFilter, progression]);

  const filteredArmor = useMemo(() => {
    return armorResults.armor.filter((entry) => {
      if (armorSlotFilter !== "All" && entry.armor.slot !== armorSlotFilter) return false;
      if (progression === "Stonewake" && entry.armor.baseWeightGroup !== "Light") return false;
      return true;
    });
  }, [armorResults.armor, armorSlotFilter, progression]);

  const isReady = totalCount >= MIN_TOTAL_ORE_COUNT;
  const approximationNote =
    "Probabilities are fitted to the published Winter 2025 weight tables; exact Forge RNG can still differ slightly.";

  function removeOre(oreId: string) {
    setSelectedOres((prev) => prev.filter((item) => item.oreId !== oreId));
  }

  function addOre(oreId: string) {
    setSelectedOres((prev) => {
      const total = prev.reduce((sum, item) => sum + item.count, 0);
      const available = Math.max(0, MAX_TOTAL_ORE_COUNT - total);
      if (available <= 0) return prev;

      const existing = prev.find((item) => item.oreId === oreId);
      if (existing) {
        return prev.map((item) =>
          item.oreId === oreId ? { ...item, count: Math.min(item.count + 1, available + item.count) } : item
        );
      }

      if (prev.length >= MAX_ORE_TYPES) return prev;

      return [...prev, { oreId, count: Math.min(1, available) || 1 }];
    });
  }

  const selectedMap = new Map(selectedOres.map((item) => [item.oreId, item.count]));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
            <button
              type="button"
              onClick={() => setMode("weapon")}
              className={cn(
                "px-4 py-2 transition",
                mode === "weapon" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
              )}
            >
              Weapon
            </button>
            <button
              type="button"
              onClick={() => setMode("armor")}
              className={cn(
                "px-4 py-2 transition",
                mode === "armor" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground hover:bg-surface-muted"
              )}
            >
              Armor
            </button>
          </div>
          {mode === "armor" ? (
            <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
              {["All", ...ARMOR_SLOTS].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setArmorSlotFilter(slot as ArmorSlot | "All")}
                  className={cn(
                    "px-4 py-2 transition",
                    armorSlotFilter === slot ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground"
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "armor" ? (
            <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
              {(["Stonewake", "Forgotten Kingdom"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProgression(value)}
                  className={cn(
                    "px-4 py-2 transition",
                    progression === value ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground"
                  )}
                >
                  {value === "Stonewake" ? "Stonewake-only" : "Forgotten Kingdom"}
                </button>
              ))}
            </div>
          ) : null}
          <span className="chip">
            {totalCount} ores selected · min {MIN_TOTAL_ORE_COUNT} · cap {MAX_TOTAL_ORE_COUNT}
          </span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.2fr)_minmax(0,1.5fr)]">
        <section className="panel space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Forge chances</p>
              <p className="text-xs text-muted">{isReady ? `${totalCount} ores in mix` : "Add at least 3 ores"}</p>
            </div>
          </div>
          <div className="space-y-3">
            {mode === "weapon"
              ? weaponResults.classProbabilities.map((entry) => {
                  const items = weaponResults.weapons
                    .filter((w) => w.weapon.class === entry.class)
                    .sort((a, b) => b.probability - a.probability);

                  return (
                    <ProbabilityRow
                      key={entry.class}
                      label={entry.class}
                      probability={isReady ? entry.probability : 0}
                      hint={`Min ${entry.minOre} ores · optimal ${entry.optimalOre}`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {items.map((item) => (
                          <span
                            key={item.weapon.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-foreground"
                          >
                            <span>{item.weapon.name}</span>
                            <span className="rounded-full bg-surface px-2 py-[1px] text-[10px] font-semibold text-muted">
                              {formatPercent(isReady ? item.probability : 0)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </ProbabilityRow>
                  );
                })
              : filteredPieceProbabilities.map((entry) => {
                  const items = filteredArmor
                    .filter((piece) => piece.anchorKey === entry.key)
                    .sort((a, b) => b.probability - a.probability);

                  return (
                    <ProbabilityRow
                      key={entry.key}
                      label={`${entry.weightGroup} ${entry.slot}`}
                      probability={isReady ? entry.probability : 0}
                      hint={`Min ${entry.minOre} ores · optimal ${entry.optimalOre}`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {items.map((item) => (
                          <span
                            key={item.armor.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-foreground"
                          >
                            <span>{item.armor.name}</span>
                            <span className="rounded-full bg-surface px-2 py-[1px] text-[10px] font-semibold text-muted">
                              {formatPercent(isReady ? item.probability : 0)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </ProbabilityRow>
                  );
                })}
          </div>
          <p className="text-xs text-muted">{approximationNote}</p>
        </section>

        <section className="space-y-6">
          <div className="panel space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Composition</p>
                <p className="text-xl font-semibold text-foreground">Total multiplier: {multiplier ? multiplier.toFixed(2) : "0.00"}x</p>
                <p className="text-xs text-muted">
                  Weighted average of ore multipliers. Traits are minor at 10% share and full at 30%.
                </p>
              </div>
              {!isReady ? (
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  Add at least {MIN_TOTAL_ORE_COUNT} ores to see odds
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-surface-muted px-3 py-2 text-xs">
              <label htmlFor="quality-tier" className="text-xs font-semibold text-foreground">
                Quality tier
              </label>
              <select
                id="quality-tier"
                value={qualityTier}
                onChange={(event) => setQualityTier(event.target.value as QualityTier)}
                className="rounded-lg border border-border/60 bg-surface px-2 py-1 text-xs font-semibold text-foreground"
              >
                {QUALITY_TIERS.map((tier) => (
                  <option key={tier.tier} value={tier.tier}>
                    {tier.tier} ({tier.multiplier.toFixed(2)}x)
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted">Quality bonus from minigame performance (does not affect odds).</span>
            </div>

            <div className="space-y-3">
              {composition.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {composition.map((entry) => (
                    // Composition card mirrors ore cards with image, percent, multiplier, and count
                    <div
                      key={entry.ore.id}
                      className="relative flex h-full min-h-[150px] flex-col justify-between rounded-xl border border-border/60 bg-surface px-3 py-3"
                    >
                      {entry.ore.imageUrl ? (
                        <div className="mb-2 flex justify-center">
                          <div className="h-16 w-16 overflow-hidden rounded-lg bg-surface-muted">
                            <Image
                              src={entry.ore.imageUrl}
                              alt={entry.ore.name}
                              width={64}
                              height={64}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeOre(entry.ore.id)}
                        className="absolute right-2 top-2 rounded-full border border-border/60 bg-surface-muted px-2 py-[2px] text-xs font-bold text-muted transition hover:border-accent/70 hover:text-foreground"
                        aria-label={`Remove ${entry.ore.name}`}
                      >
                        ×
                      </button>
                      <div className="space-y-1">
                        <p className="text-2xl font-bold leading-tight text-foreground">
                          {(entry.share * 100).toFixed(1)}%
                        </p>
                        <p className="text-sm font-semibold text-foreground">{entry.ore.name}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
                          {entry.ore.multiplier.toFixed(2)}x
                        </span>
                        <span className="rounded-full bg-accent px-2 py-1 text-[11px] font-bold text-white shadow-soft dark:bg-accent-dark">
                          x{entry.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Select up to four ore types to start planning.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Active traits</p>
              {traits.length ? (
                <div className="flex flex-wrap gap-2">
                  {traits
                    .filter((trait) => traitVisibleInMode(trait.ore.traitType, mode))
                    .map((trait) => (
                      <TraitPill
                        key={trait.ore.id}
                        ore={trait.ore}
                        share={trait.share}
                        tier={trait.tier}
                      />
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No traits active. Add at least 10% of a trait ore (30% for full strength).</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel flex h-[80vh] flex-col space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Ores & traits</p>
              <p className="text-xs text-muted">Select up to four ore types. Click to add; adjust counts below.</p>
            </div>
            <div className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
              {selectedOres.length}/{MAX_ORE_TYPES} types
            </div>
          </div>

          <input
            type="search"
            placeholder="Search ore by name, rarity, or area"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/40"
          />

          <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1">
            {["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Divine"].map((rarity) => {
              const ores = groupedByRarity[rarity];
              if (!ores || !ores.length) return null;
              return (
                <div key={rarity} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{rarity}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {ores.map((ore) => {
                      const count = selectedMap.get(ore.id) ?? 0;
                      return (
                        <OreCard
                          key={ore.id}
                          ore={ore}
                          selected={count > 0}
                          count={count}
                          onSelect={() => addOre(ore.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-foreground">
            {mode === "weapon"
              ? "Detailed weapon chances"
              : armorSlotFilter === "All"
                ? "Armor pieces"
                : `Armor pieces · ${armorSlotFilter}`}
          </p>
          <p className="text-xs text-muted">Probabilities update as you change ore counts.</p>
        </div>

        {mode === "weapon" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {weaponResults.weapons
              .sort((a, b) => b.probability - a.probability)
              .map((entry) => (
                <div key={entry.weapon.id} className="rounded-lg border border-border/60 bg-surface px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.weapon.name}</p>
                      <p className="text-xs text-muted">{entry.weapon.class}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPercent(isReady ? entry.probability : 0)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
                    <div>
                      <p className="font-semibold text-foreground">{numberFormatter.format(entry.weapon.baseDamage)}</p>
                      <p>Base DMG</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{numberFormatter.format(entry.weapon.baseSpeedSeconds)}s</p>
                      <p>Speed</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{numberFormatter.format(entry.weapon.baseRange)}</p>
                      <p>Range</p>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground">Forged damage</p>
                    <p className="text-muted">
                      {multiplier ? numberFormatter.format(entry.finalDamage) : "0"} (base {entry.weapon.baseDamage} × {multiplier.toFixed(2)} × {qualityMultiplier.toFixed(2)})
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredArmor
              .sort((a, b) => b.probability - a.probability)
              .map((entry) => (
                <div key={entry.armor.id} className="rounded-lg border border-border/60 bg-surface px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.armor.name}</p>
                      <p className="text-xs text-muted">
                        {entry.armor.weightClass} · {entry.armor.baseWeightGroup} weight
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPercent(isReady ? entry.probability : 0)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <div>
                      <p className="font-semibold text-foreground">
                        {numberFormatter.format(entry.armor.baseHealthPercent)}% base
                      </p>
                      <p>Base health bonus</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {multiplier ? numberFormatter.format(entry.finalHealthPercent) : "0"}%
                      </p>
                      <p>With multiplier + quality</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

    </div>
  );
}
