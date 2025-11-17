"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type NavItem = {
  id: string;
  rank: number;
  name: string;
  metric?: { label?: string | null; value?: number | null };
};

function formatMetric(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

type Props = {
  items: NavItem[];
  variant: "desktop" | "mobile";
  title?: string;
};

export function ListQuickNav({ items, variant, title = "Quick jump" }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    if (!ids.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0));
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0, 1.0]
      }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  if (!items.length) return null;

  const listContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        <span>{title}</span>
        <span className="text-[0.7rem] text-muted">Top {items.length}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => {
          const metricText =
            item.metric && item.metric.value != null
              ? `${formatMetric(item.metric.value)}${item.metric.label ? ` ${item.metric.label}` : ""}`
              : null;
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <Link
                href={`#${item.id}`}
                className={[
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                  "border border-border/60 hover:border-accent hover:text-accent",
                  isActive ? "bg-accent/10 text-foreground" : "text-muted"
                ].join(" ")}
                onClick={() => setOpen(false)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-[0.78rem] font-semibold text-accent">#{item.rank}</span>
                  <span className="line-clamp-1">{item.name}</span>
                </span>
                {metricText ? <span className="ml-2 text-xs text-foreground/80">{metricText}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (variant === "desktop") {
    return <div>{listContent}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
      >
        <span>{title}</span>
        <span className="text-xs text-muted">Tap to jump</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-x-0 bottom-0 top-20 rounded-t-2xl bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-1">{listContent}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
