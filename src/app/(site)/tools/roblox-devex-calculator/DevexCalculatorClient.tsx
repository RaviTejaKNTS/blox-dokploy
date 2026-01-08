'use client';

import { FormEvent, useMemo, useState } from "react";
import "@/styles/article-content.css";
import { trackEvent } from "@/lib/analytics";
import {
  calculateAdvancedDevex,
  calculateDevexPayout,
  calculateDevexRequirement
} from "@/lib/devex/calculator";
import {
  DEVEX_DEFAULT_TARGET_ROBUX,
  DEVEX_DEFAULT_TARGET_USD,
  DEVEX_MIN,
  DEVEX_NEW_RATE,
  DEVEX_OLD_RATE,
  DEVEX_RATE_EFFECTIVE_DATE
} from "@/lib/devex/constants";

type CalculatorMode = "robux_to_usd" | "usd_to_robux";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

const usdPerRobux = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

type DevexCalculatorClientProps = {
  initialRobux?: number;
  initialUsd?: number;
  initialOldRobux?: number;
  initialNewRobux?: number;
};

export function DevexCalculatorClient({
  initialRobux = DEVEX_DEFAULT_TARGET_ROBUX,
  initialUsd = DEVEX_DEFAULT_TARGET_USD,
  initialOldRobux = Math.floor(DEVEX_DEFAULT_TARGET_ROBUX / 2),
  initialNewRobux = Math.ceil(DEVEX_DEFAULT_TARGET_ROBUX / 2)
}: DevexCalculatorClientProps) {
  const [mode, setMode] = useState<CalculatorMode>("robux_to_usd");
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [robuxInput, setRobuxInput] = useState(() => initialRobux.toString());
  const [usdInput, setUsdInput] = useState(() => initialUsd.toString());
  const [oldRobuxInput, setOldRobuxInput] = useState(() => initialOldRobux.toString());
  const [newRobuxInput, setNewRobuxInput] = useState(() => initialNewRobux.toString());

  const parsedRobux = Number(robuxInput);
  const parsedUsd = Number(usdInput);
  const parsedOldRobux = Number(oldRobuxInput);
  const parsedNewRobux = Number(newRobuxInput);

  const simpleResult = useMemo(
    () => calculateDevexPayout(parsedRobux, DEVEX_NEW_RATE),
    [parsedRobux]
  );

  const advancedResult = useMemo(
    () => calculateAdvancedDevex(parsedOldRobux, parsedNewRobux),
    [parsedOldRobux, parsedNewRobux]
  );

  const requirementResult = useMemo(
    () => calculateDevexRequirement(parsedUsd, DEVEX_NEW_RATE),
    [parsedUsd]
  );

  const activeRobuxTotal = isAdvanced ? advancedResult.totalRobux : simpleResult.totalRobux;
  const activeUsd = isAdvanced ? advancedResult.totalUsd : simpleResult.usd;
  const activeEligible = isAdvanced ? advancedResult.eligible : simpleResult.eligible;
  const activeShortfall = isAdvanced ? advancedResult.shortfallRobux : simpleResult.shortfallRobux;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
          <button
            type="button"
            onClick={() => setMode("robux_to_usd")}
            className={`px-4 py-2 transition ${mode === "robux_to_usd" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
          >
            Robux → USD (DevEx)
          </button>
          <button
            type="button"
            onClick={() => setMode("usd_to_robux")}
            className={`px-4 py-2 transition ${mode === "usd_to_robux" ? "bg-accent text-white dark:bg-accent-dark" : "text-foreground"}`}
          >
            USD → Required Robux
          </button>
        </div>
      </section>

      {mode === "robux_to_usd" ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setRobuxInput(robuxInput.trim());
              trackEvent("calculator_input_commit", {
                tool_code: "roblox-devex-calculator",
                target_robux: Number(robuxInput)
              });
            }}
            className="panel space-y-5 p-6"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Robux → USD (DevEx)</h2>
              <p className="text-sm text-muted">
                Live payout estimate using the official DevEx rate of {usdPerRobux.format(DEVEX_NEW_RATE)} per earned Robux.
              </p>
            </div>

            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">How many earned Robux do you have?</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={robuxInput}
                onChange={(e) => setRobuxInput(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                placeholder={`Enter earned Robux (minimum ${formatNumber(DEVEX_MIN)})`}
              />
              <span className="text-xs text-muted">Minimum DevEx eligibility: {formatNumber(DEVEX_MIN)} earned Robux.</span>
            </label>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Advanced mode</p>
                <p className="text-xs text-muted">
                  Split earnings by the rate change on {DEVEX_RATE_EFFECTIVE_DATE}. Older Robux use {usdPerRobux.format(DEVEX_OLD_RATE)}; newer Robux use {usdPerRobux.format(DEVEX_NEW_RATE)}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanced((prev) => !prev)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isAdvanced ? "bg-accent text-white shadow-soft dark:bg-accent-dark" : "border border-border/60 text-foreground"
                }`}
                aria-pressed={isAdvanced}
              >
                {isAdvanced ? "Advanced on" : "Enable"}
              </button>
            </div>

            <div
              className={`space-y-4 overflow-hidden transition-[max-height,opacity] duration-300 ${
                isAdvanced ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
              }`}
              aria-hidden={!isAdvanced}
            >
              <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
                <span className="text-sm font-semibold text-foreground">
                  Earned Robux before {DEVEX_RATE_EFFECTIVE_DATE}
                </span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={oldRobuxInput}
                  onChange={(e) => setOldRobuxInput(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                  placeholder="Robux earned under the old rate"
                />
                <span className="text-xs text-muted">Converted at {usdPerRobux.format(DEVEX_OLD_RATE)} per Robux.</span>
              </label>

              <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
                <span className="text-sm font-semibold text-foreground">
                  Earned Robux after {DEVEX_RATE_EFFECTIVE_DATE}
                </span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={newRobuxInput}
                  onChange={(e) => setNewRobuxInput(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                  placeholder="Robux earned under the new rate"
                />
                <span className="text-xs text-muted">Converted at {usdPerRobux.format(DEVEX_NEW_RATE)} per Robux.</span>
              </label>
            </div>
          </form>

          <div className="panel flex h-full flex-col gap-6 p-6">
            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Estimated USD payout</p>
              <p className="text-3xl font-semibold text-foreground">{currency.format(activeUsd)}</p>
              <p className="text-sm text-muted">
                {isAdvanced
                  ? "Blended payout using the old and new DevEx rates."
                  : `Using the current DevEx rate of ${usdPerRobux.format(DEVEX_NEW_RATE)} per Robux.`}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">DevEx eligibility</p>
                <span className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground">
                  Minimum {formatNumber(DEVEX_MIN)} Robux
                </span>
              </div>
              <p className={`text-xl font-semibold ${activeEligible ? "text-emerald-600" : "text-amber-600"}`}>
                {activeEligible ? "You meet the DevEx minimum." : "Under the DevEx minimum."}
              </p>
              <p className="text-sm text-muted">
                {activeEligible
                  ? `You can request DevEx with ${formatNumber(activeRobuxTotal)} earned Robux.`
                  : `You need ${formatNumber(activeShortfall)} more earned Robux to reach ${formatNumber(DEVEX_MIN)}.`}
              </p>
            </div>

            {isAdvanced ? (
              <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Advanced breakdown</h3>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                    Rate change: {DEVEX_RATE_EFFECTIVE_DATE}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-foreground">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
                    <span>Before {DEVEX_RATE_EFFECTIVE_DATE} at {usdPerRobux.format(DEVEX_OLD_RATE)} / Robux</span>
                    <span className="font-semibold">{currency.format(advancedResult.oldUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
                    <span>After {DEVEX_RATE_EFFECTIVE_DATE} at {usdPerRobux.format(DEVEX_NEW_RATE)} / Robux</span>
                    <span className="font-semibold">{currency.format(advancedResult.newUsd)}</span>
                  </div>
                </div>
                <div className="rounded-md border border-border/50 bg-background/60 px-3 py-3 text-sm text-foreground">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Robux</span>
                    <span className="text-lg font-semibold">{formatNumber(advancedResult.totalRobux)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Combined USD</span>
                    <span className="font-semibold text-foreground">{currency.format(advancedResult.totalUsd)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              setUsdInput(usdInput.trim());
              trackEvent("calculator_input_commit", {
                tool_code: "roblox-devex-calculator",
                target_usd: Number(usdInput)
              });
            }}
            className="panel space-y-5 p-6"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">USD → Required Robux</h2>
              <p className="text-sm text-muted">
                Work backwards from a payout goal using the DevEx rate of {usdPerRobux.format(DEVEX_NEW_RATE)} per Robux.
              </p>
            </div>

            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">How much USD do you want to cash out?</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={usdInput}
                onChange={(e) => setUsdInput(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-white/10"
                placeholder="Enter payout target (e.g. 250)"
              />
            </label>
          </form>

          <div className="panel flex h-full flex-col gap-6 p-6">
            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Robux required for that payout</p>
              <p className="text-3xl font-semibold text-foreground">
                {formatNumber(Math.ceil(requirementResult.robuxNeeded))}
              </p>
              <p className="text-sm text-muted">
                Calculation uses the DevEx rate of {usdPerRobux.format(requirementResult.appliedRate)} per Robux.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">DevEx eligibility</p>
                <span className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground">
                  Minimum {formatNumber(DEVEX_MIN)} Robux
                </span>
              </div>
              <p className={`text-xl font-semibold ${requirementResult.eligibleAtTarget ? "text-emerald-600" : "text-amber-600"}`}>
                {requirementResult.eligibleAtTarget ? "Target meets the minimum." : "Target is below the DevEx minimum."}
              </p>
              <p className="text-sm text-muted">
                {requirementResult.eligibleAtTarget
                  ? "This payout goal is eligible once your Robux are cleared for DevEx."
                  : `You need ${formatNumber(Math.ceil(requirementResult.shortfallRobux))} more Robux to reach ${formatNumber(DEVEX_MIN)}.`}
              </p>
            </div>
          </div>
        </section>
      )}

      <p className="text-sm text-muted">
        Based on the official Roblox DevEx rate. Actual payout may vary depending on your DevEx account and taxes.
      </p>
    </div>
  );
}
