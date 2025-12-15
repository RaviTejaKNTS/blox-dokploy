'use client';

import { useEffect, useMemo, useState } from "react";
import { computeCalculation, normalizeMutations } from "@/lib/grow-a-garden/calc";
import type { CropRecord } from "@/lib/grow-a-garden/crops";
import type { Mutation, Variant } from "@/lib/grow-a-garden/mutations";
import { cn } from "@/lib/utils";

type Props = {
  crops: CropRecord[];
  variants: Variant[];
  mutations: Mutation[];
};

const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const wholeFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type BaseMode = "average" | "baseline";
type TempMutation = "default" | "Wet" | "Chilled" | "Drenched" | "Frozen";

function formatKg(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "—";
  return `${numberFmt.format(value ?? 0)} kg`;
}

function formatSheckles(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "—";
  if ((value ?? 0) >= 1000000000) return `${numberFmt.format((value ?? 0) / 1_000_000_000)}B`;
  if ((value ?? 0) >= 1_000_000) return `${numberFmt.format((value ?? 0) / 1_000_000)}M`;
  if ((value ?? 0) >= 1000) return `${numberFmt.format((value ?? 0) / 1000)}K`;
  return wholeFmt.format(value ?? 0);
}

function VariantOption({
  variant,
  selected,
  onSelect
}: {
  variant: Variant;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
        selected ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border/70 bg-surface"
      )}
    >
      <span className="text-sm font-semibold text-foreground">{variant.name}</span>
      <span className="text-xs text-muted">x{variant.multiplier}</span>
    </button>
  );
}

function MutationCard({
  mutation,
  selected,
  onToggle
}: {
  mutation: Mutation;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
        selected ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border/70 bg-surface"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border",
            selected ? "border-accent bg-accent" : "border-border/70 bg-surface"
          )}
          aria-hidden
        >
          {selected ? <span className="h-2 w-2 rounded-sm bg-white" /> : null}
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{mutation.name}</span>
      </div>
      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-[2px] text-[11px] font-semibold text-muted">
        ×{mutation.multiplier ?? "?"}
      </span>
    </button>
  );
}

export function GrowGardenCropValueCalculatorClient({
  crops,
  variants,
  mutations,
  title
}: Props) {
  const [cropSearch, setCropSearch] = useState("");
  const [selectedCropName, setSelectedCropName] = useState<string>(crops[0]?.name ?? "");
  const [baseMode, setBaseMode] = useState<BaseMode>("average");
  const [weightInput, setWeightInput] = useState<string>(
    crops[0]?.baseWeightKg ? String(crops[0].baseWeightKg) : ""
  );
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [variantName, setVariantName] = useState<string>(variants[0]?.name ?? "None");
  const [tempMutation, setTempMutation] = useState<TempMutation>("default");
  const [selectedMutations, setSelectedMutations] = useState<string[]>([]);
  const [showUnverified, setShowUnverified] = useState(false);

  const normalizedMutations = useMemo(() => normalizeMutations(selectedMutations).names, [selectedMutations]);

  useEffect(() => {
    if (normalizedMutations.join(",") !== selectedMutations.join(",")) {
      setSelectedMutations(normalizedMutations);
    }
  }, [normalizedMutations, selectedMutations]);

  const selectedCrop = useMemo(
    () => crops.find((crop) => crop.name === selectedCropName) ?? crops[0],
    [selectedCropName, crops]
  );

  function getBaseWeightFor(crop: CropRecord | undefined, mode: BaseMode) {
    if (!crop) return 1;
    if (mode === "baseline" && crop.baseWeightFloorKg) return crop.baseWeightFloorKg;
    return crop.baseWeightKg;
  }

  function getBaseValueFor(crop: CropRecord | undefined, mode: BaseMode) {
    if (!crop) return 0;
    if (mode === "baseline" && crop.baseValueFloor) return crop.baseValueFloor;
    return crop.baseValue;
  }

  const filteredCrops = useMemo(() => {
    return crops.filter((crop) => {
      if (!cropSearch) return true;
      const term = cropSearch.toLowerCase();
      return crop.name.toLowerCase().includes(term) || crop.tier.toLowerCase().includes(term);
    });
  }, [cropSearch, crops]);

  const visibleMutations = useMemo(
    () =>
      mutations
        .filter((m) => !["Wet", "Chilled", "Drenched", "Frozen"].includes(m.name))
        .filter((m) => (showUnverified ? true : m.isVerified)),
    [mutations, showUnverified]
  );

  const calculation = useMemo(() => {
    if (!selectedCrop) {
      return null;
    }
    const weightKg = Number(weightInput || 0);
    const quantity = Number(quantityInput || 0);
    const combinedMutations =
      tempMutation === "default" ? normalizedMutations : [...normalizedMutations, tempMutation];
    return computeCalculation({
      crop: selectedCrop,
      weightKg,
      quantity,
      variantName,
      mutationNames: combinedMutations,
      baseMode
    });
  }, [selectedCrop, weightInput, quantityInput, variantName, normalizedMutations, baseMode, tempMutation]);

  function handleCropChange(name: string) {
    const next = crops.find((c) => c.name === name);
    setSelectedCropName(name);
    if (next) {
      const nextWeight = getBaseWeightFor(next, baseMode);
      setWeightInput(nextWeight ? String(nextWeight) : "");
    }
  }

  function handleBaseModeChange(mode: BaseMode) {
    setBaseMode(mode);
    if (selectedCrop) {
      const nextWeight = getBaseWeightFor(selectedCrop, mode);
      setWeightInput(nextWeight ? String(nextWeight) : "");
    }
  }

  function toggleMutation(name: string) {
    setSelectedMutations((prev) => {
      const next = prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name];
      return normalizeMutations(next).names;
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Step 1 · Choose a crop</h2>
              <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-xs font-semibold shadow-soft">
                <button
                  type="button"
                  onClick={() => handleBaseModeChange("average")}
                  className={cn(
                    "px-3 py-2 transition",
                    baseMode === "average" ? "bg-accent text-white" : "text-foreground"
                  )}
                >
                  Use average
                </button>
                <button
                  type="button"
                  onClick={() => handleBaseModeChange("baseline")}
                  className={cn(
                    "px-3 py-2 transition",
                    baseMode === "baseline" ? "bg-accent text-white" : "text-foreground"
                  )}
                >
                  Use baseline
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">
              Search and pick a crop. Toggle between average or baseline values for Base Value/Weight.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                value={cropSearch}
                onChange={(e) => setCropSearch(e.target.value)}
                placeholder="Search crops or tier..."
                className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
                {filteredCrops.map((crop) => {
                  const selected = crop.name === selectedCrop?.name;
                  return (
                    <button
                      key={crop.name}
                      type="button"
                      onClick={() => handleCropChange(crop.name)}
                      className={cn(
                        "flex flex-col rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5",
                        selected ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border/70 bg-surface"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{crop.name}</p>
                        <span className="rounded-full bg-surface-muted px-2 py-[2px] text-[11px] font-semibold text-muted">
                          {crop.tier}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        Base Value ({baseMode === "average" ? "avg" : "baseline"}):{" "}
                        {formatSheckles(getBaseValueFor(crop, baseMode))} Sheckles
                      </p>
                      <p className="text-xs text-muted">
                        Base Weight ({baseMode === "average" ? "avg" : "baseline"}):{" "}
                        {formatKg(getBaseWeightFor(crop, baseMode))}
                      </p>
                      {crop.eventType ? (
                        <p className="text-[11px] font-semibold text-accent">Event: {crop.eventType}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Step 2 · Enter weight and quantity</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-foreground">
                <span className="block font-semibold">Crop weight (kg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <span className="text-xs text-muted">
                  Base Weight ({baseMode === "average" ? "avg" : "baseline"}):{" "}
                  {formatKg(getBaseWeightFor(selectedCrop, baseMode))}
                </span>
              </label>
              <label className="space-y-2 text-sm text-foreground">
                <span className="block font-semibold">Quantity</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Step 3 · Choose a Growth Mutation</h2>
            <p className="text-sm text-muted">Only one growth mutation can be active at a time.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {variants.map((variant) => (
                <VariantOption
                  key={variant.name}
                  variant={variant}
                  selected={variantName === variant.name}
                  onSelect={() => setVariantName(variant.name)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Step 4 · Choose Temperature Mutation</h2>
            <p className="text-sm text-muted">Pick one temperature mutation. This overrides Wet/Chilled/Drenched/Frozen.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { name: "default" as TempMutation, label: "Default", multiplier: 0 },
                { name: "Wet" as TempMutation, label: "Wet", multiplier: 2 },
                { name: "Chilled" as TempMutation, label: "Chilled", multiplier: 2 },
                { name: "Drenched" as TempMutation, label: "Drenched", multiplier: 5 },
                { name: "Frozen" as TempMutation, label: "Frozen", multiplier: 10 }
              ].map((temp) => {
                const selected = tempMutation === temp.name;
                return (
                  <button
                    key={temp.name}
                    type="button"
                    onClick={() => setTempMutation(temp.name)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
                      selected ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border/70 bg-surface"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border",
                          selected ? "border-accent bg-accent" : "border-border/70 bg-surface"
                        )}
                        aria-hidden
                      >
                        {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{temp.label}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-surface-muted px-2 py-[2px] text-[11px] font-semibold text-muted">
                      ×{temp.multiplier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Step 5 · Apply mutations</h2>
                <p className="text-sm text-muted">Tap to select mutations. Multipliers stack using the provided formula.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleMutations.map((mutation) => (
                <MutationCard
                  key={mutation.name}
                  mutation={mutation}
                  selected={normalizedMutations.includes(mutation.name)}
                  onToggle={() => toggleMutation(mutation.name)}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Result</h2>
            {calculation ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-col gap-2 rounded-xl bg-accent/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Total price</p>
                  <p className="text-3xl font-bold text-foreground">{formatSheckles(calculation.total)} Sheckles</p>
                  <p className="text-sm text-muted">
                    Price per crop: {formatSheckles(calculation.perCrop)} Sheckles
                  </p>
                </div>
                <div className="space-y-3 text-sm text-muted">
                  <div className="rounded-lg border border-border/60 bg-surface px-3 py-3">
                    <p className="font-semibold text-foreground">Breakdown</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>Base Value (average): {formatSheckles(calculation.baseValue)} Sheckles</li>
                      <li>Base Weight (average): {formatKg(calculation.baseWeightKg)}</li>
                      <li>Weight factor: (weight/baseWeight)² = {numberFmt.format(calculation.weightFactor)}</li>
                      <li>Growth mutation multiplier: x{numberFmt.format(calculation.variantMultiplier)}</li>
                      <li>
                        Temperature mutation: {tempMutation === "default" ? "Default (x0 added to sum)" : tempMutation}
                      </li>
                      <li>
                        Mutation multiplier: x{numberFmt.format(calculation.mutationMultiplier)}{" "}
                        {calculation.skippedMutations.length
                          ? `(skipped: ${calculation.skippedMutations.map((m) => m.name).join(", ")})`
                          : ""}
                      </li>
                      <li>
                        Formula: (BaseValue × (Weight/BaseWeight)²) × GrowthMutation × Mutation × Quantity
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-surface px-3 py-3">
                    <p className="font-semibold text-foreground">Selected mutations</p>
                    {calculation.appliedMutations.length ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {calculation.appliedMutations.map((mutation) => (
                          <li key={mutation.name}>
                            {mutation.name} — {mutation.multiplier ? `${mutation.multiplier}x` : "TBA"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">None selected.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Select a crop to see results.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
