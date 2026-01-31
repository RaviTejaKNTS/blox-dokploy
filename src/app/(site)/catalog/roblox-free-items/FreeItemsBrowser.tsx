"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { PagePagination } from "@/components/PagePagination";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildSearchQueryString,
  normalizeSearchQuery,
  normalizeSortKey,
  type FreeItemsSortKey
} from "@/lib/free-items-search";

type FreeItem = {
  asset_id: number;
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  creator_name: string | null;
  creator_id: number | null;
  creator_type: string | null;
  favorite_count: number | null;
  created_at: string;
};

type ApiResponse = {
  ok: boolean;
  items: FreeItem[];
  total: number;
  totalPages: number;
};

type Props = {
  initialItems: FreeItem[];
  initialTotalPages: number;
  currentPage: number;
  basePath: string;
  category?: string;
  subcategory?: string;
};

function buildThumbnailUrl(assetId: number): string {
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${assetId}&width=420&height=420&format=png`;
}

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/catalog/${assetId}`;
}

function formatCount(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric.toLocaleString("en-US");
}

export function FreeItemsBrowser({
  initialItems,
  initialTotalPages,
  currentPage,
  basePath,
  category,
  subcategory
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState("");
  const [sortInput, setSortInput] = useState<FreeItemsSortKey>(DEFAULT_SORT);
  const [items, setItems] = useState<FreeItem[]>(initialItems);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const urlQuery = normalizeSearchQuery(searchParams.get("q"));
  const urlSort = normalizeSortKey(searchParams.get("sort"));
  const searchQueryString = buildSearchQueryString({ query: urlQuery, sort: urlSort });
  const hasFilters = urlQuery.length > 0 || urlSort !== DEFAULT_SORT;

  useEffect(() => {
    setQueryInput(urlQuery);
    setSortInput(urlSort);
  }, [urlQuery, urlSort]);

  useEffect(() => {
    const shouldFetch = hasFetchedRef.current || hasFilters;
    if (!shouldFetch) {
      setItems(initialItems);
      setTotalPages(initialTotalPages);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (urlQuery) params.set("q", urlQuery);
    if (urlSort !== DEFAULT_SORT) params.set("sort", urlSort);
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);

    fetch(`/api/roblox-free-items?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load results (${res.status})`);
        }
        return (await res.json()) as ApiResponse;
      })
      .then((payload) => {
        if (!payload.ok) {
          throw new Error("Request failed");
        }
        setItems(payload.items ?? []);
        setTotalPages(payload.totalPages ?? 1);
        hasFetchedRef.current = true;
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError("Unable to load free items right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [category, currentPage, hasFilters, initialItems, initialTotalPages, subcategory, urlQuery, urlSort]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = normalizeSearchQuery(queryInput);
    const nextSort = sortInput;
    const nextParams = buildSearchQueryString({ query: nextQuery, sort: nextSort });
    router.push(nextParams ? `${basePath}?${nextParams}` : basePath);
  }

  function handleClear() {
    setQueryInput("");
    setSortInput(DEFAULT_SORT);
    router.push(basePath);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="free-items-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Search
          </label>
          <input
            id="free-items-search"
            name="q"
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search item name, creator, or ID"
            className="w-full rounded-lg border-0 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="w-full space-y-2 md:w-56">
          <label htmlFor="free-items-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Sort
          </label>
          <select
            id="free-items-sort"
            name="sort"
            value={sortInput}
            onChange={(event) => setSortInput(event.target.value as FreeItemsSortKey)}
            className="w-full rounded-lg border-0 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Apply
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-semibold text-muted transition hover:text-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {loading ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Updating results...</p> : null}
      {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}

      {!items.length ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No free items match those filters right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const favorites = formatCount(item.favorite_count);
            const hasMeta = Boolean(item.creator_name || item.category || item.subcategory);
            return (
              <article
                key={item.asset_id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-background/60">
                  <Image
                    src={buildThumbnailUrl(item.asset_id)}
                    alt={item.name ?? `Roblox item ${item.asset_id}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-lg">
                      Free
                    </span>
                    {item.category ? (
                      <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
                        {item.category}
                      </span>
                    ) : null}
                  </div>
                  {favorites ? (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-semibold text-white">
                      <span className="uppercase tracking-wide text-white/70">Favorites</span>
                      <span>{favorites}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">
                      {item.name ?? `Roblox item ${item.asset_id}`}
                    </h2>
                  </div>

                  {hasMeta ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {item.creator_name ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Creator</span>
                          <span className="font-semibold text-foreground line-clamp-1">{item.creator_name}</span>
                        </span>
                      ) : null}
                      {item.category ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Category</span>
                          <span className="font-semibold text-foreground">{item.category}</span>
                        </span>
                      ) : null}
                      {item.subcategory ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Subcategory</span>
                          <span className="font-semibold text-foreground">{item.subcategory}</span>
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                      <span>Item ID</span>
                      <span className="font-mono text-[0.82rem]">{item.asset_id}</span>
                      <CopyCodeButton
                        code={String(item.asset_id)}
                        tone="surface"
                        size="sm"
                        analytics={{
                          event: "free_item_copy",
                          params: {
                            asset_id: item.asset_id,
                            category: item.category ?? "",
                            subcategory: item.subcategory ?? ""
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-auto">
                    <a
                      href={buildRobloxUrl(item.asset_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                    >
                      View on Roblox
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PagePagination
        basePath={basePath}
        currentPage={currentPage}
        totalPages={totalPages}
        query={searchQueryString || undefined}
      />
    </div>
  );
}
