"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiKey } from "react-icons/fi";
import type { Code } from "@/lib/db";
import { cleanRewardsText, isCodeWithinNewThreshold } from "@/lib/code-utils";
import { trackEvent } from "@/lib/analytics";
import { CopyCodeButton } from "./CopyCodeButton";

type Props = {
  codes: Code[];
  gameName: string;
  gameSlug: string;
  lastUpdatedLabel: string;
  lastCheckedLabel: string;
  lastCheckedRelativeLabel?: string | null;
  coverImage?: string | null;
  nowMs: number;
};

type EnrichedCode = Code & {
  rewardText: string | null;
  isNew: boolean;
  addedAtLabel: string | null;
};

function normalizeCoverImage(coverImage?: string | null): string | null {
  if (!coverImage) return null;
  return coverImage.startsWith("http") ? coverImage : `/${coverImage.replace(/^\//, "")}`;
}

export function ActiveCodes({
  codes,
  gameName,
  gameSlug,
  lastUpdatedLabel,
  lastCheckedLabel,
  lastCheckedRelativeLabel,
  coverImage,
  nowMs
}: Props) {
  const storageKey = useMemo(() => {
    const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
    return `roblox-codes-checked-${slug}`;
  }, [gameName]);

  const [usedCodes, setUsedCodes] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setUsedCodes(new Set(parsed.filter((code): code is string => typeof code === "string")));
        }
      }
    } catch {
      /* ignore storage errors */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(Array.from(usedCodes));
      window.localStorage.setItem(storageKey, serialized);
    } catch {
      /* ignore storage errors */
    }
  }, [usedCodes, storageKey]);

  const enriched = useMemo<EnrichedCode[]>(() => {
    return codes.map((code) => {
      const rewardText = cleanRewardsText(code.rewards_text);
      const isNew = isCodeWithinNewThreshold(code, nowMs);
      const addedAtLabel = code.first_seen_at
        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
            new Date(code.first_seen_at)
          )
        : null;
      return { ...code, rewardText, isNew, addedAtLabel };
    });
  }, [codes, nowMs]);

  const normalizedCover = normalizeCoverImage(coverImage);

  function toggleUsed(code: string) {
    const nextUsed = !usedCodes.has(code);
    setUsedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
    trackEvent("code_mark_used", { game_slug: gameSlug, code, used: nextUsed });
  }

  return (
    <section className="panel overflow-hidden" id="active-codes">
      <div className="relative overflow-hidden border-b border-border/60">
        {normalizedCover ? (
          <Image
            src={normalizedCover}
            alt={`${gameName} key art`}
            fill
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover opacity-80 blur-[1px]"
            priority={false}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(var(--color-surface))] via-[rgb(var(--color-background))] to-[rgb(var(--color-surface-muted))] opacity-85" />
        <div className="relative px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border/70 bg-surface text-foreground shadow-soft backdrop-blur">
                <FiKey className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mb-0 text-2xl font-bold leading-tight text-foreground drop-shadow-sm sm:text-3xl">
                Active {gameName} Codes
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-base text-foreground/85">
              <span className="inline-flex items-center gap-2">
                <FiClock aria-hidden className="h-4 w-4 shrink-0" />
                <span>
                  Last checked for new codes on{" "}
                  <span className="font-semibold text-foreground">{lastCheckedLabel}</span>
                  {lastCheckedRelativeLabel ? (
                    <span className="text-foreground/70"> ({lastCheckedRelativeLabel})</span>
                  ) : null}
                </span>
              </span>
              <span className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-[0.85rem] font-semibold text-foreground">
                {codes.length} active
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-surface px-4 py-5 sm:px-6 sm:py-7">
        {enriched.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-border/50 bg-surface-muted/70 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">No active codes right now</p>
              <p className="text-muted">
                We have not confirmed any working codes at the moment. Check back soon for the next drop.
              </p>
            </div>
            <span className="rounded-full border border-border/50 bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Waiting for updates
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.map((code, index) => {
              const isUsed = usedCodes.has(code.code);
              const displayReward = code.rewardText
                ? (/this code gives you/i.test(code.rewardText) ? code.rewardText : `You get ${code.rewardText}`)
                : null;
              return (
                <article
                  key={code.id}
                  className={`relative overflow-hidden rounded-[var(--radius-sm)] border border-border/60 bg-surface shadow-soft transition hover:border-accent/35 ${
                    isUsed ? "opacity-80 grayscale-[0.05]" : ""
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 hover:opacity-100" />
                  <div className="relative grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-5">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleUsed(code.code)}
                        className={`group relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-surface-muted/80 transition ${
                          isUsed ? "border-accent/50 bg-accent/10" : "hover:border-border/40"
                        }`}
                        aria-pressed={isUsed}
                        aria-label={isUsed ? "Mark as unused" : "Mark as used"}
                        title={isUsed ? "Mark as unused" : "Mark as used"}
                      >
                        <span className={`text-sm font-semibold text-muted transition ${isUsed ? "opacity-0" : "opacity-100 group-hover:opacity-0"}`}>
                          {index + 1}
                        </span>
                        <span
                          className={`absolute inset-0 grid place-items-center transition-opacity ${
                            isUsed ? "opacity-100 text-accent" : "opacity-0 text-foreground/80 group-hover:opacity-100"
                          }`}
                        >
                          <FiCheckCircle className="h-4 w-4" />
                        </span>
                      </button>
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <code
                            className={`font-mono text-lg font-bold tracking-[0.14em] sm:text-xl ${
                              isUsed ? "line-through text-muted" : "text-foreground"
                            }`}
                          >
                            {code.code}
                          </code>
                          {code.isNew ? (
                            <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                              New
                            </span>
                          ) : null}
                          {code.level_requirement != null ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-muted px-2.5 py-1 text-[0.72rem] font-semibold tracking-wide text-foreground/90">
                              Level {code.level_requirement}+
                            </span>
                          ) : null}
                        </div>
                        <p className={`text-sm ${isUsed ? "line-through text-muted" : "text-foreground/85"}`}>
                          {displayReward ?? <span className="text-muted">No reward listed yet.</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 pl-14 sm:pl-0 sm:justify-end sm:gap-3 sm:[&>*]:whitespace-nowrap">
                      <CopyCodeButton
                        code={code.code}
                        tone="accent"
                        analytics={{
                          event: "copy_code",
                          params: {
                            game_slug: gameSlug,
                            code: code.code,
                            is_new: code.isNew,
                            status: "active"
                          }
                        }}
                      />
                      {code.addedAtLabel ? (
                        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">
                          Added {code.addedAtLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
