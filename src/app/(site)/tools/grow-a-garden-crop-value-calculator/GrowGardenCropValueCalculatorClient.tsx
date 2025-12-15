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
  metaLastUpdated: string | null;
  introHtml?: string;
  howHtml?: string;
};

const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const wholeFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

function MutationPill({
  mutation,
  selected,
  onToggle
}: {
  mutation: Mutation;
  selected: boolean;
  onToggle: () => void;
}) {
  const badge =
    mutation.type === "fusion"
      ? "Fusion"
      : mutation.type === "standard"
        ? "Standard"
        : mutation.type === "limited"
          ? "Limited"
          : "Admin";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition hover:-translate-y-0.5",
        selected ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border/60 bg-surface"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{mutation.name}</span>
        <span className="rounded-full bg-surface-muted px-2 py-[2px] text-[11px] font-semibold text-muted">{badge}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>{mutation.multiplier ? `${mutation.multiplier}x` : "TBA"}</span>
        {mutation.isVerified ? null : <span className="rounded-full bg-orange-100 px-2 py-[1px] text-[10px] font-semibold text-orange-700">Unverified</span>}
      </div>
      {mutation.conflicts.length ? (
        <p className="text-[11px] text-muted">Conflicts: {mutation.conflicts.join(", ")}</p>
      ) : null}
    </button>
  );
}

export function GrowGardenCropValueCalculatorClient({
  crops,
  variants,
  mutations,
  metaLastUpdated,
  introHtml,
  howHtml
}: Props) {
  const [cropSearch, setCropSearch] = useState("");
  const [selectedCropName, setSelectedCropName] = useState<string>(crops[0]?.name ?? "");
  const [weightKg, setWeightKg] = useState<number>(crops[0]?.baseWeightKg ?? 1);
  const [quantity, setQuantity] = useState<number>(1);
  const [variantName, setVariantName] = useState<string>(variants[0]?.name ?? "None");
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

  const filteredCrops = useMemo(() => {
    return crops.filter((crop) => {
      if (!cropSearch) return true;
      const term = cropSearch.toLowerCase();
      return crop.name.toLowerCase().includes(term) || crop.tier.toLowerCase().includes(term);
    });
  }, [cropSearch, crops]);

  const visibleMutations = useMemo(
    () => mutations.filter((m) => (showUnverified ? true : m.isVerified)),
    [mutations, showUnverified]
  );

  const calculation = useMemo(() => {
    if (!selectedCrop) {
      return null;
    }
    return computeCalculation({
      crop: selectedCrop,
      weightKg,
      quantity,
      variantName,
      mutationNames: normalizedMutations
    });
  }, [selectedCrop, weightKg, quantity, variantName, normalizedMutations]);

  function handleCropChange(name: string) {
    const next = crops.find((c) => c.name === name);
    setSelectedCropName(name);
    if (next?.baseWeightKg) setWeightKg(next.baseWeightKg);
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
            <h2 className="text-lg font-semibold text-foreground">Step 1 · Choose a crop</h2>
            <p className="text-sm text-muted">Search and pick a crop. We use its average value as Base Value and average weight as Base Weight.</p>
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
                      <p className="mt-2 text-xs text-muted">Base Value (avg): {formatSheckles(crop.baseValue)} Sheckles</p>
                      <p className="text-xs text-muted">Base Weight (avg): {formatKg(crop.baseWeightKg)}</p>
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
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <span className="text-xs text-muted">Base Weight: {formatKg(selectedCrop?.baseWeightKg)}</span>
              </label>
              <label className="space-y-2 text-sm text-foreground">
                <span className="block font-semibold">Quantity</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Step 3 · Choose a variant</h2>
            <p className="text-sm text-muted">Only one variant can be active at a time.</p>
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
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Step 4 · Apply mutations</h2>
                <p className="text-sm text-muted">
                  Conflicts and fusions resolve automatically. Unverified mutations are hidden by default.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={showUnverified}
                  onChange={(e) => setShowUnverified(e.target.checked)}
                  className="h-4 w-4 rounded border-border/70 text-accent focus:ring-accent/40"
                />
                Show unverified
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleMutations.map((mutation) => (
                <MutationPill
                  key={mutation.name}
                  mutation={mutation}
                  selected={normalizedMutations.includes(mutation.name)}
                  onToggle={() => toggleMutation(mutation.name)}
                />
              ))}
            </div>
            {normalizedMutations.length ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {normalizedMutations.map((name) => (
                  <button
                    key={name}
                    onClick={() => toggleMutation(name)}
                    className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent"
                  >
                    {name} <span className="text-[11px]">×</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-surface/70 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">Step 5 · Result</h2>
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
                      <li>Variant multiplier: x{numberFmt.format(calculation.variantMultiplier)}</li>
                      <li>
                        Mutation multiplier: x{numberFmt.format(calculation.mutationMultiplier)}{" "}
                        {calculation.skippedMutations.length
                          ? `(skipped: ${calculation.skippedMutations.map((m) => m.name).join(", ")})`
                          : ""}
                      </li>
                      <li>
                        Formula: (BaseValue × (Weight/BaseWeight)²) × Variant × Mutation × Quantity
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

          <div className="rounded-2xl border border-dashed border-border/70 bg-surface/60 p-4">
            <h3 className="text-sm font-semibold text-foreground">How this calculator works</h3>
            {howHtml ? (
              <div className="article-content prose-sm text-muted" dangerouslySetInnerHTML={{ __html: howHtml }} />
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                <li>Uses crop Average Value as Base Value and Average Weight as Base Weight.</li>
                <li>Crop Value = Base Value × (Weight / Base Weight)².</li>
                <li>Mutation Multiplier = Variant × (1 + sum(mutation multipliers) − count(mutations)).</li>
                <li>Total = Crop Value × Mutation Multiplier × Quantity.</li>
              </ul>
            )}
            {metaLastUpdated ? (
              <p className="mt-3 text-xs font-semibold text-muted">Data last updated on {metaLastUpdated}</p>
            ) : null}
          </div>

          {introHtml ? (
            <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
              <div className="article-content prose-sm text-muted" dangerouslySetInnerHTML={{ __html: introHtml }} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
