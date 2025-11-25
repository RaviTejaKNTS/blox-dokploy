'use client';

import { FormEvent, useMemo, useState } from "react";
import "@/styles/article-content.css";
import { RobuxBundle } from "./robux-bundles";

type PlatformOption = "pc_web" | "mobile";
type CalculatorMode = "robux_to_usd" | "usd_to_robux";

type PlanBreakdown = { bundle: RobuxBundle; count: number; robuxPerBundle: number; pricePerBundle: number };

type RobuxPlan = {
  totalRobux: number;
  totalPrice: number;
  approxCostForRequested: number;
  isExact: boolean;
  breakdown: PlanBreakdown[];
};

type BudgetPlan = {
  totalRobux: number;
  totalPrice: number;
  approxRobuxForBudget: number;
  breakdown: PlanBreakdown[];
};

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

function formatBaseRobux(bundle: RobuxBundle): string {
  const mobile = bundle.baseMobile != null ? `${formatNumber(bundle.baseMobile)} Robux (mobile)` : null;
  const pcWeb = bundle.basePcWeb != null ? `${formatNumber(bundle.basePcWeb)} Robux (PC/Web)` : null;
  if (mobile && pcWeb) return `${mobile} / ${pcWeb}`;
  return mobile ?? pcWeb ?? "—";
}

function formatPremiumBonus(bundle: RobuxBundle): string {
  const mobile = bundle.bonusMobile != null ? `${formatNumber(bundle.bonusMobile)} Robux (mobile)` : null;
  const pcWeb = bundle.bonusPcWeb != null ? `${formatNumber(bundle.bonusPcWeb)} Robux (PC/Web)` : null;
  if (mobile && pcWeb) return `${mobile} / ${pcWeb}`;
  return mobile ?? pcWeb ?? "—";
}

function robuxForBundle(bundle: RobuxBundle, platform: PlatformOption, hasPremium: boolean): number | null {
  const base = platform === "pc_web" ? bundle.basePcWeb : bundle.baseMobile;
  if (base == null) return null;
  const bonus = hasPremium ? (platform === "pc_web" ? bundle.bonusPcWeb : bundle.bonusMobile) ?? 0 : 0;
  return base + bonus;
}

// thresholds to avoid huge DP arrays; fallback to greedy if larger
const ROBUX_DP_CAP = 200000; // robux
const BUDGET_DP_CAP_CENTS = 300000; // $3000

function greedyRobuxPlan(target: number, platform: PlatformOption, hasPremium: boolean, bundles: RobuxBundle[]): RobuxPlan | null {
  const candidates = bundles
    .filter((b) => b.active)
    .map((b) => {
      const robux = robuxForBundle(b, platform, hasPremium);
      if (!robux || robux <= 0) return null;
      return { bundle: b, robux, price: b.priceUsd, value: robux / b.priceUsd };
    })
    .filter((entry): entry is { bundle: RobuxBundle; robux: number; price: number; value: number } => Boolean(entry))
    .sort((a, b) => b.value - a.value || b.robux - a.robux || a.price - b.price);

  if (!candidates.length) return null;

  let remaining = Math.max(1, Math.floor(target));
  const breakdown: PlanBreakdown[] = [];

  for (const c of candidates) {
    if (remaining <= 0) break;
    const count = Math.max(1, Math.ceil(remaining / c.robux));
    breakdown.push({ bundle: c.bundle, count, robuxPerBundle: c.robux, pricePerBundle: c.price });
    remaining -= count * c.robux;
  }

  if (!breakdown.length) return null;

  const totalRobux = breakdown.reduce((sum, entry) => sum + entry.robuxPerBundle * entry.count, 0);
  const totalPrice = breakdown.reduce((sum, entry) => sum + entry.pricePerBundle * entry.count, 0);
  const approxCostForRequested = totalRobux > 0 ? (target / totalRobux) * totalPrice : totalPrice;

  return {
    totalRobux,
    totalPrice,
    approxCostForRequested,
    isExact: totalRobux === target,
    breakdown
  };
}

function buildRobuxPlan(target: number, platform: PlatformOption, hasPremium: boolean, bundles: RobuxBundle[]): RobuxPlan | null {
  const desired = Math.max(1, Math.floor(target));
  if (desired > ROBUX_DP_CAP) {
    return greedyRobuxPlan(desired, platform, hasPremium, bundles);
  }

  const candidates = bundles
    .filter((bundle) => bundle.active)
    .map((bundle) => {
      const robux = robuxForBundle(bundle, platform, hasPremium);
      if (!robux || robux <= 0) return null;
      return { bundle, robux, price: bundle.priceUsd };
    })
    .filter((entry): entry is { bundle: RobuxBundle; robux: number; price: number } => Boolean(entry));

  if (!candidates.length) return null;

  const cap = desired;
  const inf = Number.POSITIVE_INFINITY;
  type State = { price: number; robux: number; counts: Map<string, number> };
  const dp: State[] = Array(cap + 1)
    .fill(null)
    .map(() => ({ price: inf, robux: 0, counts: new Map() }));
  dp[0] = { price: 0, robux: 0, counts: new Map() };

  const better = (a: State, b: State) => {
    if (a.price !== b.price) return a.price < b.price;
    const overA = a.robux - cap;
    const overB = b.robux - cap;
    if (overA !== overB) return overA < overB;
    const countA = Array.from(a.counts.values()).reduce((s, c) => s + c, 0);
    const countB = Array.from(b.counts.values()).reduce((s, c) => s + c, 0);
    if (countA !== countB) return countA < countB;
    const valueA = a.robux / Math.max(1, a.price);
    const valueB = b.robux / Math.max(1, b.price);
    if (valueA !== valueB) return valueA > valueB;
    return false;
  };

  for (let r = 0; r < cap; r++) {
    const current = dp[r];
    if (!Number.isFinite(current.price)) continue;
    for (const c of candidates) {
      const nextR = Math.min(cap, r + c.robux);
      const candidate: State = {
        price: current.price + c.price,
        robux: r + c.robux,
        counts: new Map(current.counts)
      };
      candidate.counts.set(c.bundle.id, (candidate.counts.get(c.bundle.id) ?? 0) + 1);
      if (better(candidate, dp[nextR])) {
        dp[nextR] = candidate;
      }
    }
  }

  const best = dp[cap];
  if (!Number.isFinite(best.price)) return greedyRobuxPlan(desired, platform, hasPremium, bundles);

  const breakdown = Array.from(best.counts.entries())
    .map(([id, count]) => {
      const match = candidates.find((c) => c.bundle.id === id);
      if (!match) return null;
      return { bundle: match.bundle, count, robuxPerBundle: match.robux, pricePerBundle: match.price };
    })
    .filter((entry): entry is PlanBreakdown => Boolean(entry))
    .sort((a, b) => a.bundle.sortOrder - b.bundle.sortOrder);

  const totalRobux = best.robux;
  const totalPrice = best.price;
  const approxCostForRequested = totalRobux > 0 ? (desired / totalRobux) * totalPrice : totalPrice;
  const multiBundleCount = breakdown.reduce((sum, entry) => sum + entry.count, 0);

  // Find best single bundle that meets/exceeds the target
  const singleCandidate = candidates
    .filter((c) => c.robux >= desired)
    .sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      if (a.robux !== b.robux) return b.robux - a.robux;
      return a.bundle.sortOrder - b.bundle.sortOrder;
    })[0];

  if (singleCandidate && multiBundleCount > 1) {
    const multiWithTax = totalPrice * 1.1; // 10% estimated tax
    if (multiWithTax >= singleCandidate.price) {
      const singleBreakdown: PlanBreakdown[] = [
        {
          bundle: singleCandidate.bundle,
          count: 1,
          robuxPerBundle: singleCandidate.robux,
          pricePerBundle: singleCandidate.price
        }
      ];
      const singleRobux = singleCandidate.robux;
      const singlePrice = singleCandidate.price;
      return {
        totalRobux: singleRobux,
        totalPrice: singlePrice,
        approxCostForRequested: singleRobux > 0 ? (desired / singleRobux) * singlePrice : singlePrice,
        isExact: singleRobux === desired,
        breakdown: singleBreakdown
      };
    }
  }

  return {
    totalRobux,
    totalPrice,
    approxCostForRequested,
    isExact: totalRobux === desired,
    breakdown
  };
}

function buildBudgetPlan(budget: number, hasPremium: boolean, bundles: RobuxBundle[]): BudgetPlan | null {
  const budgetCents = Math.max(0, Math.round(budget * 100));
  const candidates = bundles
    .filter((bundle) => bundle.active)
    .map((bundle) => {
      const robux = robuxForBundle(bundle, "pc_web", hasPremium); // PC/Web preferred
      if (!robux || robux <= 0) return null;
      return { bundle, robux, price: Math.round(bundle.priceUsd * 100) };
    })
    .filter((entry): entry is { bundle: RobuxBundle; robux: number; price: number } => Boolean(entry));

  if (!candidates.length) return null;

  if (budgetCents > BUDGET_DP_CAP_CENTS) {
    // greedy: pick best value bundle until budget exhausted
    const sorted = candidates
      .map((c) => ({ ...c, value: c.robux / c.price }))
      .sort((a, b) => b.value - a.value || a.price - b.price);
    let remaining = budgetCents;
    const breakdown: PlanBreakdown[] = [];
    for (const c of sorted) {
      if (remaining < Math.min(...sorted.map((s) => s.price))) break;
      const count = Math.floor(remaining / c.price);
      if (count <= 0) continue;
      breakdown.push({ bundle: c.bundle, count, robuxPerBundle: c.robux, pricePerBundle: c.price / 100 });
      remaining -= count * c.price;
    }
    if (!breakdown.length) {
      const cheapest = sorted[0];
      breakdown.push({ bundle: cheapest.bundle, count: 1, robuxPerBundle: cheapest.robux, pricePerBundle: cheapest.price / 100 });
    }
    const totalRobux = breakdown.reduce((s, e) => s + e.robuxPerBundle * e.count, 0);
    const totalPrice = breakdown.reduce((s, e) => s + e.pricePerBundle * e.count, 0);
    const approxRobuxForBudget = totalPrice > 0 ? (budget / totalPrice) * totalRobux : totalRobux;
    return { totalRobux, totalPrice, approxRobuxForBudget, breakdown };
  }

  type State = { robux: number; price: number; counts: Map<string, number> };
  const dp: State[] = Array(budgetCents + 1)
    .fill(null)
    .map(() => ({ robux: 0, price: 0, counts: new Map() }));

  const better = (a: State, b: State) => {
    if (a.robux !== b.robux) return a.robux > b.robux;
    if (a.price !== b.price) return a.price > b.price; // closer to budget
    const countA = Array.from(a.counts.values()).reduce((s, c) => s + c, 0);
    const countB = Array.from(b.counts.values()).reduce((s, c) => s + c, 0);
    if (countA !== countB) return countA < countB;
    const valueA = a.robux / Math.max(1, a.price);
    const valueB = b.robux / Math.max(1, b.price);
    if (valueA !== valueB) return valueA > valueB;
    return false;
  };

  for (let cost = 0; cost <= budgetCents; cost++) {
    const current = dp[cost];
    for (const c of candidates) {
      const nextCost = cost + c.price;
      if (nextCost > budgetCents) continue;
      const candidate: State = {
        robux: current.robux + c.robux,
        price: current.price + c.price,
        counts: new Map(current.counts)
      };
      candidate.counts.set(c.bundle.id, (candidate.counts.get(c.bundle.id) ?? 0) + 1);
      if (better(candidate, dp[nextCost])) {
        dp[nextCost] = candidate;
      }
    }
  }

  let best = dp[budgetCents];
  for (let cost = budgetCents; cost >= 0; cost--) {
    if (better(dp[cost], best)) {
      best = dp[cost];
    }
  }

  if (best.robux === 0) {
    const cheapest = candidates.reduce((min, c) => (c.price < min.price ? c : min), candidates[0]);
    best = { robux: cheapest.robux, price: cheapest.price, counts: new Map([[cheapest.bundle.id, 1]]) };
  }

  const breakdown = Array.from(best.counts.entries())
    .map(([id, count]) => {
      const match = candidates.find((c) => c.bundle.id === id);
      if (!match) return null;
      return { bundle: match.bundle, count, robuxPerBundle: match.robux, pricePerBundle: match.price / 100 };
    })
    .filter((entry): entry is PlanBreakdown => Boolean(entry))
    .sort((a, b) => a.bundle.sortOrder - b.bundle.sortOrder);

  const totalRobux = best.robux;
  const totalPrice = best.price / 100;
  const approxRobuxForBudget = totalPrice > 0 ? (budget / totalPrice) * totalRobux : totalRobux;

  return {
    totalRobux,
    totalPrice,
    approxRobuxForBudget,
    breakdown
  };
}

function breakdownRobuxForPlatform(breakdown: PlanBreakdown[] | undefined, platform: PlatformOption, hasPremium: boolean): number {
  if (!breakdown) return 0;
  return breakdown.reduce((sum, entry) => {
    const robux = robuxForBundle(entry.bundle, platform, hasPremium) ?? entry.robuxPerBundle;
    return sum + robux * entry.count;
  }, 0);
}

function formatBundleLine(entry: PlanBreakdown, platform: PlatformOption, hasPremium: boolean): string {
  const baseRobux = robuxForBundle(entry.bundle, platform, false) ?? entry.robuxPerBundle;
  const premiumRobux = robuxForBundle(entry.bundle, platform, true) ?? baseRobux;
  const premiumNote =
    premiumRobux !== baseRobux ? ` (${formatNumber(premiumRobux)} Robux for Premium users)` : "";
  return `${entry.count} × ${formatNumber(baseRobux)} Robux${premiumNote} — ${currency.format(entry.pricePerBundle)}`;
}

export function RobuxPurchaseClient({ bundles }: { bundles: RobuxBundle[] }) {
  const [mode, setMode] = useState<CalculatorMode>("robux_to_usd");
  const [targetRobuxInput, setTargetRobuxInput] = useState("4600");
  const [targetUsdInput, setTargetUsdInput] = useState("9.99");
  const [hasPremium, setHasPremium] = useState(false);

  const activeBundles = useMemo(
    () =>
      bundles
        .filter((bundle) => bundle.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [bundles]
  );

  const parsedRobux = Number(targetRobuxInput);
  const parsedUsd = Number(targetUsdInput);
  const robuxPlanPc = Number.isFinite(parsedRobux) && parsedRobux > 0 ? buildRobuxPlan(parsedRobux, "pc_web", hasPremium, bundles) : null;
  const robuxPlanMobile = Number.isFinite(parsedRobux) && parsedRobux > 0 ? buildRobuxPlan(parsedRobux, "mobile", hasPremium, bundles) : null;
  const robuxPlan = (() => {
    const options = [robuxPlanPc ? { plan: robuxPlanPc, platform: "pc_web" as const } : null, robuxPlanMobile ? { plan: robuxPlanMobile, platform: "mobile" as const } : null].filter(
      Boolean
    ) as { plan: RobuxPlan; platform: PlatformOption }[];
    if (!options.length) return null;
    options.sort((a, b) => {
      if (a.plan.totalPrice !== b.plan.totalPrice) return a.plan.totalPrice - b.plan.totalPrice;
      if (a.plan.totalRobux !== b.plan.totalRobux) return b.plan.totalRobux - a.plan.totalRobux;
      // prefer pc_web when otherwise equal
      if (a.platform !== b.platform) return a.platform === "pc_web" ? -1 : 1;
      return 0;
    });
    return { ...options[0].plan, platform: options[0].platform };
  })();
  const budgetPlan = Number.isFinite(parsedUsd) && parsedUsd > 0 ? buildBudgetPlan(parsedUsd, hasPremium, bundles) : null;

  const mobileRobuxForRobuxPlan = robuxPlan ? breakdownRobuxForPlatform(robuxPlan.breakdown, "mobile", hasPremium) : null;
  const pcRobuxForRobuxPlan = robuxPlan ? breakdownRobuxForPlatform(robuxPlan.breakdown, "pc_web", hasPremium) : null;
  const mobileRobuxForBudgetPlan = budgetPlan ? breakdownRobuxForPlatform(budgetPlan.breakdown, "mobile", hasPremium) : null;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Calculator</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Robux to USD (and USD to Robux) Calculator</h1>
        <p className="max-w-3xl text-base text-muted md:text-lg">
          Toggle between Robux → USD or USD → Robux. We build the cheapest plan from real Roblox bundles and show the exact bundle breakdown.
        </p>
        <div className="inline-flex overflow-hidden rounded-full border border-border/70 bg-surface text-sm font-semibold shadow-soft">
          <button
            type="button"
            onClick={() => setMode("robux_to_usd")}
            className={`px-4 py-2 transition ${mode === "robux_to_usd" ? "bg-accent text-white" : "text-foreground"}`}
          >
            Robux → USD
          </button>
          <button
            type="button"
            onClick={() => setMode("usd_to_robux")}
            className={`px-4 py-2 transition ${mode === "usd_to_robux" ? "bg-accent text-white" : "text-foreground"}`}
          >
            USD → Robux
          </button>
        </div>
      </section>

      {mode === "robux_to_usd" ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setTargetRobuxInput(targetRobuxInput.trim()); }} className="panel space-y-5 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Robux to USD</h2>
            </div>
            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">How many Robux do you want?</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={targetRobuxInput}
                onChange={(e) => setTargetRobuxInput(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-black/10"
                placeholder="Enter amount (e.g. 4600)"
              />
            </label>
            <div className="flex flex-wrap gap-3 rounded-lg border border-border/60 bg-surface px-4 py-4 shadow-soft">
              <span className="text-sm font-semibold text-foreground w-full">Do you have Roblox Premium?</span>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${hasPremium ? "border-accent bg-accent/10 text-foreground" : "border-border/60"}`}>
                <input type="radio" name="premium" value="yes" checked={hasPremium} onChange={() => setHasPremium(true)} className="accent-accent" />
                <span>Yes</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${!hasPremium ? "border-accent bg-accent/10 text-foreground" : "border-border/60"}`}>
                <input type="radio" name="premium" value="no" checked={!hasPremium} onChange={() => setHasPremium(false)} className="accent-accent" />
                <span>No</span>
              </label>
            </div>
          </form>

          <div className="panel flex h-full flex-col gap-6 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Your plan</h2>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Approx cost for exactly {Number.isFinite(parsedRobux) ? formatNumber(parsedRobux) : "—"} Robux</p>
              <p className="text-3xl font-semibold text-foreground">
                {robuxPlan ? currency.format(robuxPlan.approxCostForRequested) : "—"}
              </p>
              <p className="text-sm text-muted">This is just an approximate amount for the Robux you need.</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-3">
              <p className="text-sm text-muted">Roblox only sells Robux in fixed bundles, so we pick the bundle that gives the best value per dollar.</p>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Bundle price ({robuxPlan?.platform === "pc_web" ? "PC / Web / Gift Cards" : "Mobile / Microsoft Store"})
                </h3>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Recommended</span>
              </div>
              <p className="text-3xl font-semibold text-foreground">{robuxPlan ? currency.format(robuxPlan.totalPrice) : "—"}</p>
              <p className="text-lg font-semibold text-foreground">
                Robux you will receive: <span className="text-2xl">{robuxPlan ? formatNumber(robuxPlan.totalRobux) : "—"}</span>
              </p>
              <div className="space-y-1 text-sm text-foreground">
                {robuxPlan?.breakdown.map((entry) => (
                  <p key={entry.bundle.id}>{formatBundleLine(entry, robuxPlan.platform, hasPremium)}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setTargetUsdInput(targetUsdInput.trim()); }} className="panel space-y-5 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">USD to Robux</h2>
            </div>
            <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
              <span className="text-sm font-semibold text-foreground">How much USD do you have?</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={targetUsdInput}
                onChange={(e) => setTargetUsdInput(e.target.value)}
                className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-black/10"
                placeholder="Enter budget (e.g. 9.99)"
              />
            </label>
            <div className="flex flex-wrap gap-3 rounded-lg border border-border/60 bg-surface px-4 py-4 shadow-soft">
              <span className="text-sm font-semibold text-foreground w-full">Do you have Roblox Premium?</span>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${hasPremium ? "border-accent bg-accent/10 text-foreground" : "border-border/60"}`}>
                <input type="radio" name="premium" value="yes" checked={hasPremium} onChange={() => setHasPremium(true)} className="accent-accent" />
                <span>Yes</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${!hasPremium ? "border-accent bg-accent/10 text-foreground" : "border-border/60"}`}>
                <input type="radio" name="premium" value="no" checked={!hasPremium} onChange={() => setHasPremium(false)} className="accent-accent" />
                <span>No</span>
              </label>
            </div>
          </form>

          <div className="panel flex h-full flex-col gap-6 p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Your plan</h2>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Approx Robux for exactly {Number.isFinite(parsedUsd) ? currency.format(parsedUsd) : "—"}</p>
              <p className="text-3xl font-semibold text-foreground">
                {budgetPlan ? formatNumber(Math.round(budgetPlan.approxRobuxForBudget)) : "—"}
              </p>
              <p className="text-sm text-muted">This is just an approximate amount of Robux you get for the price you entered.</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-3">
              <p className="text-sm text-muted">Roblox only sells Robux in fixed bundles, so we pick the bundle that gives the best value per dollar.</p>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Bundle price (PC / Web / Gift Cards)</h3>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Recommended</span>
              </div>
              <p className="text-3xl font-semibold text-foreground">{budgetPlan ? currency.format(budgetPlan.totalPrice) : "—"}</p>
              <p className="text-lg font-semibold text-foreground">
                Robux you will receive: <span className="text-2xl">{budgetPlan ? formatNumber(budgetPlan.totalRobux) : "—"}</span>
              </p>
              <div className="space-y-1 text-sm text-foreground">
                {budgetPlan?.breakdown.map((entry) => (
                  <p key={entry.bundle.id}>{formatBundleLine(entry, "pc_web", hasPremium)}</p>
                ))}
              </div>
            </div>
            </div>
          </section>
        )}

      <section className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Robux pricing table</h2>
            <p className="text-sm text-muted">Same data the calculator uses — active bundles only.</p>
          </div>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
            Live data source for calculator
          </span>
        </div>

        <div className="table-scroll-wrapper">
          <div className="table-scroll-inner game-copy">
            <table>
              <thead>
                <tr>
                  <th className="table-col-compact">Price (USD)</th>
                  <th>Base Robux</th>
                  <th>Premium bonus</th>
                  <th>Platforms</th>
                  <th className="table-col-compact">1 Robux price (USD)</th>
                </tr>
              </thead>
              <tbody>
                {activeBundles.map((bundle) => {
                  const bestBase = Math.max(bundle.basePcWeb ?? 0, bundle.baseMobile ?? 0);
                  const pricePerRobux = bestBase > 0 ? usdPerRobux.format(bundle.priceUsd / bestBase) : "—";
                  const cleanNotes = bundle.notes === "Marked with * in Roblox store." ? null : bundle.notes;
                  const platformsDisplay = Array.from(
                    new Set([
                      ...bundle.platforms.map((platform) => platform.replace(/\*+$/, "")),
                      ...(bundle.platforms.includes("Roblox Website") ? ["Roblox PC/Mac App"] : [])
                    ])
                  );
                  return (
                    <tr key={bundle.id}>
                      <td className="font-semibold text-foreground">{currency.format(bundle.priceUsd)}</td>
                      <td className="text-muted">{formatBaseRobux(bundle)}</td>
                      <td className="text-muted">{formatPremiumBonus(bundle)}</td>
                      <td className="space-y-1">
                        <div className="flex flex-wrap gap-2 text-sm text-foreground">
                          {platformsDisplay.map((platform) => (
                            <span key={platform}>{platform}</span>
                          ))}
                        </div>
                        {cleanNotes ? <p className="text-[11px] text-muted">{cleanNotes}</p> : null}
                      </td>
                      <td className="text-muted">{pricePerRobux}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
