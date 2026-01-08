"use client";

import { useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { trackEvent } from "@/lib/analytics";

type Props = {
  codes: string[];
  gameName: string;
  gameSlug: string;
};

const COLLAPSED_MAX_HEIGHT = 128; // ~4 rows of chips

export function ExpiredCodes({ codes, gameName, gameSlug }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...codes], [codes]);
  const showToggle = sorted.length > 4;
  const shouldCollapse = showToggle && !expanded;
  const hasCodes = sorted.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="prose prose-headings:mt-0 prose-headings:mb-1 prose-p:mt-1 dark:prose-invert max-w-none">
          <h2 className="text-lg font-semibold">Expired {gameName} Codes</h2>
          {hasCodes ? <p className="text-sm text-muted">These codes are expired and no longer work.</p> : null}
        </div>
        {showToggle ? (
          <button
            type="button"
            onClick={() => {
              const next = !expanded;
              setExpanded(next);
              trackEvent("expired_codes_toggle", { game_slug: gameSlug, expanded: next });
            }}
            className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition hover:text-accent"
            aria-expanded={expanded}
            aria-label={expanded ? "Show fewer expired codes" : "Show more expired codes"}
          >
            <span className="leading-none">{expanded ? "Show Less" : "Show More"}</span>
            <FiChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {!hasCodes ? (
        <p className="text-sm text-muted">We haven't tracked any expired codes yet.</p>
      ) : (
        <div className="relative">
          <ul
            className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground transition-[max-height]"
            style={{
              maxHeight: shouldCollapse ? COLLAPSED_MAX_HEIGHT : undefined,
              overflow: shouldCollapse ? "hidden" : "visible"
            }}
            aria-expanded={showToggle ? expanded : undefined}
          >
            {sorted.map((code) => (
              <li
                key={code}
                className="flex items-center rounded-full border border-border/60 px-2 py-1 text-xs font-medium text-foreground"
              >
                <code className="leading-none">{code}</code>
              </li>
            ))}
          </ul>
          {shouldCollapse ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          ) : null}
        </div>
      )}
    </div>
  );
}
