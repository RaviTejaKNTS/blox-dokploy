import { RobuxBundle } from "./robux-bundles";

export type PlatformOption = "pc_web" | "mobile";

export type PlanBreakdown = { bundle: RobuxBundle; count: number; robuxPerBundle: number; pricePerBundle: number };

export type RobuxPlan = {
  totalRobux: number;
  totalPrice: number;
  approxCostForRequested: number;
  isExact: boolean;
  breakdown: PlanBreakdown[];
};

export type BudgetPlan = {
  totalRobux: number;
  totalPrice: number;
  approxRobuxForBudget: number;
  breakdown: PlanBreakdown[];
};

export type PlanWithPlatform = RobuxPlan & { platform: PlatformOption };

export const DEFAULT_TARGET_ROBUX = 4600;
export const DEFAULT_TARGET_USD = 9.99;
export const DEFAULT_HAS_PREMIUM = false;

// thresholds to avoid huge DP arrays; fallback to greedy if larger
const ROBUX_DP_CAP = 200000; // robux
const BUDGET_DP_CAP_CENTS = 300000; // $3000

export function robuxForBundle(bundle: RobuxBundle, platform: PlatformOption, hasPremium: boolean): number | null {
  const base = platform === "pc_web" ? bundle.basePcWeb : bundle.baseMobile;
  if (base == null) return null;
  const bonus = hasPremium ? (platform === "pc_web" ? bundle.bonusPcWeb : bundle.bonusMobile) ?? 0 : 0;
  return base + bonus;
}

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

export function buildRobuxPlan(target: number, platform: PlatformOption, hasPremium: boolean, bundles: RobuxBundle[]): RobuxPlan | null {
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

  const maxRobux = candidates.reduce((max, c) => Math.max(max, c.robux), 0);
  const cap = desired + maxRobux;
  type State = { price: number; robux: number; counts: Map<string, number>; bundleCount: number };
  const dp: (State | null)[] = Array(cap + 1)
    .fill(null)
    .map(() => null);
  dp[0] = { price: 0, robux: 0, counts: new Map(), bundleCount: 0 };

  const betterForSameRobux = (a: State, b: State) => {
    if (a.bundleCount !== b.bundleCount) return a.bundleCount < b.bundleCount;
    if (a.price !== b.price) return a.price < b.price;
    return false;
  };

  for (let r = 0; r <= cap; r++) {
    const current = dp[r];
    if (!current) continue;
    for (const c of candidates) {
      const nextR = r + c.robux;
      if (nextR > cap) continue;
      const candidate: State = {
        price: current.price + c.price,
        robux: nextR,
        counts: new Map(current.counts),
        bundleCount: current.bundleCount + 1
      };
      candidate.counts.set(c.bundle.id, (candidate.counts.get(c.bundle.id) ?? 0) + 1);
      const existing = dp[nextR];
      if (!existing || betterForSameRobux(candidate, existing)) {
        dp[nextR] = candidate;
      }
    }
  }

  const best = (() => {
    let bestState: State | null = null;
    for (let r = desired; r <= cap; r++) {
      const state = dp[r];
      if (!state) continue;
      if (!bestState) {
        bestState = state;
        continue;
      }
      const overA = state.robux - desired;
      const overB = bestState.robux - desired;
      if (overA !== overB) {
        if (overA < overB) bestState = state;
        continue;
      }
      if (state.bundleCount !== bestState.bundleCount) {
        if (state.bundleCount < bestState.bundleCount) bestState = state;
        continue;
      }
      if (state.price !== bestState.price) {
        if (state.price < bestState.price) bestState = state;
        continue;
      }
      const valueA = state.robux / Math.max(1, state.price);
      const valueB = bestState.robux / Math.max(1, bestState.price);
      if (valueA > valueB) bestState = state;
    }
    return bestState;
  })();

  if (!best) return greedyRobuxPlan(desired, platform, hasPremium, bundles);

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

  return {
    totalRobux,
    totalPrice,
    approxCostForRequested,
    isExact: totalRobux === desired,
    breakdown
  };
}

export function buildValueBundlePlan(target: number, hasPremium: boolean, bundles: RobuxBundle[]): PlanWithPlatform | null {
  const desired = Math.max(1, Math.floor(target));
  const candidates = bundles
    .filter((bundle) => bundle.active)
    .flatMap((bundle) =>
      (["pc_web", "mobile"] as PlatformOption[]).map((platform) => {
        const robux = robuxForBundle(bundle, platform, hasPremium);
        if (!robux || robux <= 0) return null;
        return { bundle, platform, robux, price: bundle.priceUsd };
      })
    )
    .filter((entry): entry is { bundle: RobuxBundle; platform: PlatformOption; robux: number; price: number } => Boolean(entry));

  if (!candidates.length) return null;

  const meetsTarget = candidates.filter((c) => c.robux >= desired);
  const pool = meetsTarget.length ? meetsTarget : candidates;

  pool.sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    const valueA = a.robux / a.price;
    const valueB = b.robux / b.price;
    if (valueA !== valueB) return valueB - valueA;
    if (a.robux !== b.robux) return b.robux - a.robux;
    if (a.platform !== b.platform) return a.platform === "pc_web" ? -1 : 1;
    return a.bundle.sortOrder - b.bundle.sortOrder;
  });

  const pick = pool[0];
  const breakdown: PlanBreakdown[] = [{ bundle: pick.bundle, count: 1, robuxPerBundle: pick.robux, pricePerBundle: pick.price }];
  const approxCostForRequested = pick.robux > 0 ? (desired / pick.robux) * pick.price : pick.price;

  return {
    platform: pick.platform,
    totalRobux: pick.robux,
    totalPrice: pick.price,
    approxCostForRequested,
    isExact: pick.robux === desired,
    breakdown
  };
}

export function buildBudgetPlan(budget: number, hasPremium: boolean, bundles: RobuxBundle[]): BudgetPlan | null {
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

export function breakdownRobuxForPlatform(breakdown: PlanBreakdown[] | undefined, platform: PlatformOption, hasPremium: boolean): number {
  if (!breakdown) return 0;
  return breakdown.reduce((sum, entry) => {
    const robux = robuxForBundle(entry.bundle, platform, hasPremium) ?? entry.robuxPerBundle;
    return sum + robux * entry.count;
  }, 0);
}

export function selectBestRobuxPlan(pcPlan: RobuxPlan | null, mobilePlan: RobuxPlan | null): PlanWithPlatform | null {
  const options = [
    pcPlan ? { plan: pcPlan, platform: "pc_web" as const } : null,
    mobilePlan ? { plan: mobilePlan, platform: "mobile" as const } : null
  ].filter(Boolean) as { plan: RobuxPlan; platform: PlatformOption }[];
  if (!options.length) return null;
  options.sort((a, b) => {
    if (a.plan.totalPrice !== b.plan.totalPrice) return a.plan.totalPrice - b.plan.totalPrice;
    if (a.plan.totalRobux !== b.plan.totalRobux) return b.plan.totalRobux - a.plan.totalRobux;
    // prefer pc_web when otherwise equal
    if (a.platform !== b.platform) return a.platform === "pc_web" ? -1 : 1;
    return 0;
  });
  return { ...options[0].plan, platform: options[0].platform };
}
