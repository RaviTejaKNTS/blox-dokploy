"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

import type { SearchItem } from "./UnifiedSearch";

const UnifiedSearch = dynamic(() => import("@/components/UnifiedSearch").then((mod) => mod.UnifiedSearch), {
  ssr: false,
  loading: () => (
    <div className="space-y-3">
      <div className="h-10 rounded-[var(--radius-lg)] border border-border/60 bg-surface animate-pulse" />
      <div className="space-y-2">
        <div className="h-12 rounded-[var(--radius-lg)] border border-border/60 bg-surface animate-pulse" />
        <div className="h-12 rounded-[var(--radius-lg)] border border-border/60 bg-surface animate-pulse" />
        <div className="h-12 rounded-[var(--radius-lg)] border border-border/60 bg-surface animate-pulse" />
      </div>
    </div>
  )
});

export function GlobalSearchOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handleTrigger(event: Event) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-search-trigger]')) return;
      event.preventDefault();
      openOverlay();
    }

    document.addEventListener("click", handleTrigger);
    return () => {
      document.removeEventListener("click", handleTrigger);
    };
  }, []);

  const openOverlay = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOpen(false);
    previousActiveElement.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;

    let cancelled = false;
    async function fetchItems() {
      try {
        setLoading(true);
        const response = await fetch("/api/search/all", { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as { items: SearchItem[] };
        if (!cancelled) {
          setItems(payload.items);
          fetchedRef.current = true;
        }
      } catch (error) {
        console.error("Failed to load search data", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchItems();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
    }

    function onFocus(event: FocusEvent) {
      const modal = document.getElementById("global-search-overlay");
      if (!modal) return;
      if (!modal.contains(event.target as Node)) {
        const focusable = modal.querySelector<HTMLElement>("button, input, a, textarea, select, [tabindex]:not([tabindex='-1'])");
        focusable?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focus", onFocus, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focus", onFocus, true);
    };
  }, [isOpen, closeOverlay]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const { overflow, touchAction } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.touchAction = touchAction;
    };
  }, [isOpen]);

  if (!isMounted) {
    return null;
  }

  const overlayContent = isOpen ? (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeOverlay();
      }}
    >
      <div
        id="global-search-overlay"
        className="relative w-full max-w-3xl rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-soft max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">Search Bloxodes</h2>
          <button
            type="button"
            onClick={closeOverlay}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-sm text-muted transition hover:border-accent hover:text-accent"
            aria-label="Close search"
          >
            ×
          </button>
        </div>
        <div className="mt-4">
          {loading && items.length === 0 ? (
            <div className="space-y-3">
              <div className="h-10 rounded-[var(--radius-lg)] border border-border/60 bg-surface-muted animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-[var(--radius-lg)] border border-border/60 bg-surface-muted animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <UnifiedSearch items={items} autoFocus />
          )}
        </div>
      </div>
    </div>
  ) : null;

  return overlayContent ? createPortal(overlayContent, document.body) : null;
}
