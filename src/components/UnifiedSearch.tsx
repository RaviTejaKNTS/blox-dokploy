"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatUpdatedLabel } from "@/lib/updated-label";

export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  type: "codes" | "article" | "checklist" | "list" | "tool";
  updatedAt?: string | null;
  badge?: string | null;
};

type Props = {
  items: SearchItem[];
  autoFocus?: boolean;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalize(value).replace(/\\s+/g, "");
}

function scoreItem(item: SearchItem, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const title = normalize(item.title);
  const subtitle = normalize(item.subtitle ?? "");
  const tokens = normalizedQuery.split(" ");
  const compactQuery = compact(query);
  const compactTitle = compact(item.title);

  let score = 0;
  if (title === normalizedQuery) score += 200;
  if (title.startsWith(normalizedQuery)) score += 140;
  if (title.includes(normalizedQuery)) score += 100;
  if (subtitle.includes(normalizedQuery)) score += 40;

  const initials = item.title
    .split(/\\s+/)
    .map((part) => part[0]?.toLowerCase() ?? "")
    .join("");
  if (initials && initials.startsWith(compactQuery)) score += 50;

  // sequential compact match
  let seqScore = 0;
  let cursor = 0;
  for (const char of compactQuery) {
    const idx = compactTitle.indexOf(char, cursor);
    if (idx === -1) {
      seqScore = 0;
      break;
    }
    seqScore += Math.max(3 - (idx - cursor), 1);
    cursor = idx + 1;
  }
  if (seqScore) score += 30 + seqScore;

  let tokenMatches = 0;
  for (const token of tokens) {
    if (token && title.includes(token)) tokenMatches += 1;
  }
  if (tokenMatches) {
    score += tokenMatches * 12 + (tokenMatches === tokens.length ? 15 : 0);
  }

  return score;
}

export function UnifiedSearch({ items, autoFocus = false }: Props) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    setVisibleCount(15);
  }, [query]);

  const { results, normalizedQuery } = useMemo(() => {
    const trimmed = query.trim();
    const normalized = normalize(trimmed);
    if (!normalized) return { results: [], normalizedQuery: "" };

    const scored = items
      .map((item) => ({ item, score: scoreItem(item, trimmed) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const dateA = a.item.updatedAt ? new Date(a.item.updatedAt).getTime() : 0;
        const dateB = b.item.updatedAt ? new Date(b.item.updatedAt).getTime() : 0;
        return dateB - dateA;
      });

    return { results: scored.map(({ item }) => item), normalizedQuery: trimmed };
  }, [items, query]);

  const limitedResults = results.slice(0, visibleCount);
  const hasMore = results.length > visibleCount;

  const placeholder = "Search articles, codes, checklists, tools, and lists";

  return (
    <div className="space-y-6">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-4 text-muted">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m21 21-4.35-4.35" />
            <circle cx="11" cy="11" r="6" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label="Search site"
          className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-surface px-5 py-3 pl-12 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          autoFocus={autoFocus}
        />
      </div>

      {normalizedQuery ? (
        <p className="text-sm text-muted">
          {results.length > 0 ? (
            <>
              Found {results.length} {results.length === 1 ? "match" : "matches"} for "{normalizedQuery}"
            </>
          ) : (
            <>No results for "{normalizedQuery}". Try a different keyword.</>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted">Start typing to search articles, codes, checklists, tools, and lists.</p>
      )}

      {normalizedQuery && results.length > 0 ? (
        <>
          <ul className="space-y-3">
            {limitedResults.map((item) => {
              const updatedLabel = item.updatedAt ? formatUpdatedLabel(item.updatedAt) : null;
              return (
                <li key={item.id}>
                  <Link
                    href={item.url}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm text-foreground transition hover:border-accent hover:text-accent"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{item.title}</span>
                      <span className="text-xs text-muted">
                        {item.subtitle ?? item.type}
                        {item.badge ? ` • ${item.badge}` : ""}
                      </span>
                    </div>
                    {updatedLabel ? <span className="text-xs text-muted whitespace-nowrap">{updatedLabel}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 15)}
                className="w-full rounded-full border border-border/60 bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
              >
                Show more results
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
