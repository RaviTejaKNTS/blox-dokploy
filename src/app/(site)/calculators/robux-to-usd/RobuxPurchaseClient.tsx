'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/article-content.css";
import { RobuxBundle } from "./robux-bundles";
import {
  BudgetPlan,
  DEFAULT_HAS_PREMIUM,
  DEFAULT_TARGET_ROBUX,
  DEFAULT_TARGET_USD,
  PlanBreakdown,
  PlanWithPlatform,
  PlatformOption,
  buildBudgetPlan,
  buildRobuxPlan,
  buildValueBundlePlan,
  robuxForBundle,
  selectBestRobuxPlan
} from "./robux-plans";

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

// Keep identical class strings on server and client to avoid hydration mismatches.
const TEXT_BASE_CLASS = "article-content prose dark:prose-invert game-copy max-w-4xl text-muted";
const INTRO_TEXT_CLASS = "article-content prose dark:prose-invert game-copy max-w-4xl text-muted space-y-4";
const BODY_TEXT_CLASS = "article-content prose dark:prose-invert game-copy max-w-4xl text-muted space-y-3";
const GUIDE_TEXT_CLASS = "article-content prose dark:prose-invert game-copy max-w-4xl text-muted space-y-6";

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

function formatBundleLine(entry: PlanBreakdown, platform: PlatformOption, hasPremium: boolean): string {
  const baseRobux = robuxForBundle(entry.bundle, platform, false) ?? entry.robuxPerBundle;
  const premiumRobux = robuxForBundle(entry.bundle, platform, true) ?? baseRobux;
  const premiumNote =
    premiumRobux !== baseRobux ? ` (${formatNumber(premiumRobux)} Robux for Premium users)` : "";
  return `${entry.count} × ${formatNumber(baseRobux)} Robux${premiumNote} — ${currency.format(entry.pricePerBundle)}`;
}

function platformLabel(platform: PlatformOption | null): string {
  if (platform === "pc_web") return "PC / Web / Gift Cards";
  if (platform === "mobile") return "Mobile / Microsoft Store";
  return "—";
}

type RobuxPurchaseClientProps = {
  bundles: RobuxBundle[];
  initialRobuxTarget?: number;
  initialUsdTarget?: number;
  initialHasPremium?: boolean;
  initialRobuxPlan?: PlanWithPlatform | null;
  initialValuePlan?: PlanWithPlatform | null;
  initialBudgetPlan?: BudgetPlan | null;
};

export function RobuxPurchaseClient({
  bundles,
  initialRobuxTarget = DEFAULT_TARGET_ROBUX,
  initialUsdTarget = DEFAULT_TARGET_USD,
  initialHasPremium = DEFAULT_HAS_PREMIUM,
  initialRobuxPlan = null,
  initialValuePlan = null,
  initialBudgetPlan = null
}: RobuxPurchaseClientProps) {
  const [mode, setMode] = useState<CalculatorMode>("robux_to_usd");
  const [targetRobuxInput, setTargetRobuxInput] = useState(() => initialRobuxTarget.toString());
  const [targetUsdInput, setTargetUsdInput] = useState(() => initialUsdTarget.toString());
  const [hasPremium, setHasPremium] = useState(initialHasPremium);
  const [robuxPlan, setRobuxPlan] = useState<PlanWithPlatform | null>(initialRobuxPlan ?? null);
  const [valueBundlePlan, setValueBundlePlan] = useState<PlanWithPlatform | null>(initialValuePlan ?? null);
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(initialBudgetPlan ?? null);

  const activeBundles = useMemo(
    () =>
      bundles
        .filter((bundle) => bundle.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [bundles]
  );

  const parsedRobux = Number(targetRobuxInput);
  const parsedUsd = Number(targetUsdInput);

  useEffect(() => {
    if (Number.isFinite(parsedRobux) && parsedRobux > 0) {
      const pcPlan = buildRobuxPlan(parsedRobux, "pc_web", hasPremium, bundles);
      const mobilePlan = buildRobuxPlan(parsedRobux, "mobile", hasPremium, bundles);
      setRobuxPlan(selectBestRobuxPlan(pcPlan, mobilePlan));
      setValueBundlePlan(buildValueBundlePlan(parsedRobux, hasPremium, bundles));
    } else {
      setRobuxPlan(null);
      setValueBundlePlan(null);
    }
  }, [parsedRobux, hasPremium, bundles]);

  useEffect(() => {
    if (Number.isFinite(parsedUsd) && parsedUsd > 0) {
      setBudgetPlan(buildBudgetPlan(parsedUsd, hasPremium, bundles));
    } else {
      setBudgetPlan(null);
    }
  }, [parsedUsd, hasPremium, bundles]);

  const displayRobuxPlan = robuxPlan;
  const displayValuePlan = valueBundlePlan;
  const displayBudgetPlan = budgetPlan;
  const formattedTargetRobux = Number.isFinite(parsedRobux) ? formatNumber(parsedRobux) : "—";

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Calculator</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Robux to USD (and USD to Robux) Calculator</h1>
        <div className={INTRO_TEXT_CLASS}>
          <p>
            This calculator shows how much real USD you would spend for the Robux you want. If you already have Robux, you can use it to know how much worth of Robux you have in your account. We also suggest the best value bundles if you are planning to buy.
          </p>
          <p>
            It works both ways. If you have a fixed budget, you can instantly see how many Robux you will get for that amount. Just toggle between Robux → USD or USD → Robux.
          </p>
        </div>
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
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
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
            <div className="space-y-2" />

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Approx cost for exactly {formattedTargetRobux} Robux</p>
              <p className="text-3xl font-semibold text-foreground">
                {displayRobuxPlan ? currency.format(displayRobuxPlan.approxCostForRequested) : "—"}
              </p>
              <p className="text-sm text-muted">This is just an approximate amount for the Robux you need.</p>
            </div>

            <p className="text-sm text-muted">Roblox only sells Robux in fixed bundles — here are the two best ways to cover your target.</p>

            <div className="grid items-stretch gap-4 md:grid-cols-2">
              <div className="flex h-full flex-col gap-4 rounded-lg border border-border/60 bg-surface px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-tight text-foreground max-w-[70%]">Bundle to get just as much as needed</h3>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Cheapest</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-4">
                  <p className="text-3xl font-semibold text-foreground">
                    {displayRobuxPlan ? currency.format(displayRobuxPlan.totalPrice) : "—"}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    Robux you will receive: <span className="text-2xl">{displayRobuxPlan ? formatNumber(displayRobuxPlan.totalRobux) : "—"}</span>
                  </p>
                </div>
                <div className="flex-1" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
                    <span>Bundle breakdown</span>
                    <span className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-foreground">
                      {platformLabel(displayRobuxPlan?.platform ?? null)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-foreground">
                    {displayRobuxPlan?.breakdown.map((entry) => (
                      <p key={entry.bundle.id}>{formatBundleLine(entry, displayRobuxPlan.platform, hasPremium)}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col gap-4 rounded-lg border border-border/60 bg-surface px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-tight text-foreground max-w-[70%]">Best value for money bundle</h3>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">Best value</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-4">
                  <p className="text-3xl font-semibold text-foreground">
                    {displayValuePlan ? currency.format(displayValuePlan.totalPrice) : "—"}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    Robux you will receive: <span className="text-2xl">{displayValuePlan ? formatNumber(displayValuePlan.totalRobux) : "—"}</span>
                  </p>
                </div>
                <div className="flex-1" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
                    <span>Bundle breakdown</span>
                    <span className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-foreground">
                      {platformLabel(displayValuePlan?.platform ?? null)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-foreground">
                    {displayValuePlan?.breakdown.map((entry) => (
                      <p key={entry.bundle.id}>{formatBundleLine(entry, displayValuePlan.platform, hasPremium)}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
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
            <div className="space-y-2" />
            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-2">
              <p className="text-sm text-muted">Approx Robux for exactly {Number.isFinite(parsedUsd) ? currency.format(parsedUsd) : "—"}</p>
              <p className="text-3xl font-semibold text-foreground">
                {displayBudgetPlan ? formatNumber(Math.round(displayBudgetPlan.approxRobuxForBudget)) : "—"}
              </p>
              <p className="text-sm text-muted">This is just an approximate amount of Robux you get for the price you entered.</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-surface px-4 py-4 space-y-3">
              <p className="text-sm text-muted">Roblox only sells Robux in fixed bundles, so we pick the bundle that gives the best value per dollar.</p>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Bundle price (PC / Web / Gift Cards)</h3>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Recommended</span>
              </div>
              <p className="text-3xl font-semibold text-foreground">{displayBudgetPlan ? currency.format(displayBudgetPlan.totalPrice) : "—"}</p>
              <p className="text-lg font-semibold text-foreground">
                Robux you will receive: <span className="text-2xl">{displayBudgetPlan ? formatNumber(displayBudgetPlan.totalRobux) : "—"}</span>
              </p>
              <div className="space-y-1 text-sm text-foreground">
                {displayBudgetPlan?.breakdown.map((entry) => (
                  <p key={entry.bundle.id}>{formatBundleLine(entry, "pc_web", hasPremium)}</p>
                ))}
              </div>
            </div>
            </div>
        </section>
      )}

      <section className={BODY_TEXT_CLASS}>
        <h2 className="text-2xl font-semibold text-foreground">How this calculator actually works</h2>
        <p>
          Roblox never lets you pay for an exact custom amount of Robux. You always buy fixed bundles, and the bundle values change between PC/web, mobile, and Premium. So instead of guessing a fake per-Robux rate, the calculator uses the real bundles you see in the pricing table below.
        </p>
        <p>
          If you type Robux, it finds the cheapest way to hit your target based on live bundles, compares PC/web and mobile, applies Premium if needed, and shows the closest plan with as little extra spend as possible. If you type dollars, it flips the logic: it tries to get you the maximum Robux your budget can buy using the highest value bundles without going over.
        </p>
        <p>The calculator always follows the current official USD bundles and builds realistic purchase plans around them.</p>
      </section>

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

      <section className={GUIDE_TEXT_CLASS}>
        <div>
          <h2>Where you can buy Robux</h2>
          <p>You can buy Robux in a few official places:</p>
          <ul>
            <li>Roblox website</li>
            <li>Roblox PC / Mac app</li>
            <li>Roblox mobile app</li>
            <li>Microsoft Store app</li>
            <li>Roblox gift cards from stores or online retailers</li>
          </ul>
          <p>In general:</p>
          <ul>
            <li><strong>PC / web / gift cards usually give more Robux for the same price</strong></li>
            <li><strong>Mobile bundles often give less Robux</strong> for the same listed price</li>
          </ul>
          <p>
            The pricing table on this page shows which platforms each bundle supports and how many Robux you get there. Use it to avoid overpaying just because you bought from the wrong place.
          </p>
        </div>

        <div>
          <h2>What people normally buy with Robux</h2>
          <p>This helps you understand whether something in a game is cheap or expensive in real money.</p>
          <ul>
            <li>Around <strong>400 Robux</strong> → most game passes or avatar bundles</li>
            <li>Around <strong>1,000 Robux</strong> → premium items in top anime RPGs or multiple game passes</li>
            <li>Around <strong>5,000 Robux</strong> → full avatar makeover + limited items + private server + game passes</li>
            <li><strong>10,000+ Robux</strong> → layered clothing bundles, limiteds and big game upgrades</li>
          </ul>
          <p>The calculator lets you see the real USD value before you buy, so you know exactly what that “399 Robux” item means for your wallet.</p>
        </div>

        <div>
          <h2>Roblox Premium in simple terms</h2>
          <p>Roblox Premium is a monthly subscription that gives:</p>
          <ul>
            <li>A monthly Robux payout based on your plan</li>
            <li>Extra Robux every time you buy a Robux bundle</li>
            <li>The ability to sell some items and use the trading system</li>
            <li>Extra perks inside some games if the developer supports Premium</li>
          </ul>
          <p>The current Premium tiers are:</p>
          <ul>
            <li>Premium 450</li>
            <li>Premium 1,000</li>
            <li>Premium 2,200</li>
          </ul>
          <p>Each tier costs more per month but gives more Robux.</p>
          <p>
            When you flip the Premium toggle in the calculator, you see how much extra value you get for the same purchase. That helps you decide if Premium makes sense for how you play.
          </p>
        </div>

        <div>
          <h2>If your price looks different on Roblox</h2>
          <p>If you are outside the United States, Roblox shows prices in your local currency. Those prices:</p>
          <ul>
            <li>Are not always a perfect live conversion from USD</li>
            <li>Can be rounded or adjusted per country</li>
            <li>Can change when Roblox updates bundle values</li>
          </ul>
          <p>This calculator uses USD bundle prices as the base, then converts Robux amounts into dollars.</p>
          <p>
            If your local store shows a slightly different final price, treat the calculator as a close guide, not a perfect local invoice.
          </p>
        </div>

        <div>
          <h2>Easy ways to avoid wasting money</h2>
          <p>A few mistakes make players and parents lose extra money without noticing:</p>
          <ul>
            <li>Buying on mobile when PC or web would give more Robux for the same price</li>
            <li>Buying many small bundles instead of one medium or big bundle</li>
            <li>Forgetting to log into the Premium account before purchasing</li>
            <li>Clicking random links in chats, comments, or DMs that promise free Robux</li>
          </ul>
          <p>Use the calculator on this page to:</p>
          <ul>
            <li>Check the real money cost of the Robux you want</li>
            <li>See which bundle gives you the best value</li>
            <li>Decide whether to buy from mobile or switch to PC or gift cards first</li>
          </ul>
        </div>

        <div>
          <h2>DevEx payouts use different calculations</h2>
          <p>
            Developers who exchange Robux for real money through DevEx get a different USD rate than players who buy Robux. DevEx includes taxes, platform fees, and eligibility rules, so the value per Robux is much lower compared to normal purchases.
          </p>
          <p>
            This calculator is not optimized for DevEx payouts. If you want to check how much money developers earn from Robux, use the dedicated DevEx calculator instead.
          </p>
        </div>

        <div>
          <h2>Commonly Asked Questions</h2>
          <div className="space-y-5">
            <div className="space-y-2">
              <p><strong>Q:</strong> Robux calculator AUD or Robux calculator pounds?</p>
              <p><strong>A:</strong> This calculator uses USD. If you pay in AUD, GBP or another currency, your bank or card provider converts from USD automatically. You can still use these numbers as a close guide to how expensive a purchase is.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> Is buying Robux on mobile worse than PC or web?</p>
              <p><strong>A:</strong> Often yes. The price looks similar, but you usually get fewer Robux for the same amount on mobile.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> Why are my prices slightly different from this calculator?</p>
              <p><strong>A:</strong> Roblox uses regional pricing and may adjust bundle values. This tool follows the main USD bundles and uses those as the base.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> Can I get a refund for Robux purchases?</p>
              <p><strong>A:</strong> In most cases Robux purchases are final. In rare cases Roblox may refund Robux if a paid item you own is removed or moderated.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> Are Robux generators or “free Robux” sites real?</p>
              <p><strong>A:</strong> No. They are almost always scams that try to steal your account or make money from surveys.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 350 Robux in USD?</p>
              <p><strong>A:</strong> 350 Robux is roughly <strong>$3 to $4</strong> on PC/Web, since it sits between the $2.99 and $4.99 bundles.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 499 Robux in USD?</p>
              <p><strong>A:</strong> 499 Robux is basically one 500 Robux bundle, so it is around <strong>$4.99</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 2400 Robux in USD?</p>
              <p><strong>A:</strong> 2400 Robux usually lands near a 2000 + 500 style combination, so expect roughly <strong>$24 to $25</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 7000 Robux in USD (7k Robux in USD)?</p>
              <p><strong>A:</strong> 7000 Robux is in the <strong>$70 range</strong> on PC/Web, depending on which mix of bundles you use.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 9999 Robux in USD?</p>
              <p><strong>A:</strong> 9999 Robux is effectively the same as 10,000 Robux, which is about <strong>$100</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 40000 Robux in USD (40k Robux to USD)?</p>
              <p><strong>A:</strong> 40000 Robux is in the <strong>high $300s</strong>, usually somewhere around <strong>$360 to $400</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 48000 Robux in USD (48000 Robux to USD)?</p>
              <p><strong>A:</strong> 48000 Robux lines up well with two of the largest packs, so it is close to <strong>$400</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 50000 Robux in USD (50000 Robux in USD)?</p>
              <p><strong>A:</strong> 50000 Robux usually ends up in the <strong>low $400s</strong>, roughly <strong>$410 to $450</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 70000 Robux in USD (70000 Robux to USD)?</p>
              <p><strong>A:</strong> 70000 Robux usually lands in the <strong>$600 to $650</strong> range on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 85000 Robux in USD (85000 Robux to USD)?</p>
              <p><strong>A:</strong> 85000 Robux can easily go above <strong>$750</strong>, often sitting somewhere between <strong>$750 and $850</strong> on PC/Web.</p>
            </div>
            <div className="space-y-2">
              <p><strong>Q:</strong> How much is 999999999 Robux in USD?</p>
              <p><strong>A:</strong> 999,999,999 Robux is a meme-level amount. In real terms, it would cost <strong>millions of dollars</strong> if it were even possible to buy that much directly.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
