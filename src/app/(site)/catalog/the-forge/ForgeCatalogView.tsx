"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

const FALLBACK_IMAGE = "/og-image.png";

type ForgeCatalogStat = { key: string; label: string };

type ForgeCatalogConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  stats?: ForgeCatalogStat[];
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
};

type ForgeCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: string | number | null | undefined;
};

type ForgeCatalogSection = {
  id: string;
  label: string;
  items: ForgeCatalogItem[];
};

type ViewMode = "cards" | "list";

type ForgeCatalogViewProps = {
  sections: ForgeCatalogSection[];
  config: ForgeCatalogConfig;
};

function resolveImageSrc(image: string | null | undefined): string {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) return image;
  return `/${image}`;
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  return String(value);
}

function formatKeyLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildSubtitle(item: ForgeCatalogItem, config: ForgeCatalogConfig): string | null {
  if (!config.subtitleKeys?.length) return null;
  const parts = config.subtitleKeys
    .map((key) => normalizeValue(item[key]))
    .filter(Boolean) as string[];
  if (!parts.length) return null;
  return parts.join(" | ");
}

function buildStatEntries(item: ForgeCatalogItem, config: ForgeCatalogConfig) {
  const stats = (config.stats ?? [])
    .map((stat) => ({
      label: stat.label,
      value: normalizeValue(item[stat.key])
    }))
    .filter((stat) => Boolean(stat.value));

  if (!stats.length) return [];
  const maxStats = config.maxStats ?? stats.length;
  return stats.slice(0, maxStats);
}

function renderValue(value: string | null) {
  if (!value) {
    return <span className="text-xs text-muted">—</span>;
  }
  return <span className="text-sm text-foreground">{value}</span>;
}

function ForgeItemCard({ item, config }: { item: ForgeCatalogItem; config: ForgeCatalogConfig }) {
  const badge = config.badgeKey ? normalizeValue(item[config.badgeKey]) : null;
  const subtitle = buildSubtitle(item, config);
  const description = config.descriptionKey ? normalizeValue(item[config.descriptionKey]) : null;
  const stats = buildStatEntries(item, config);
  const image = resolveImageSrc(item.image ?? null);

  return (
    <article
      id={`item-${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-background/60">
        <Image
          src={image}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
          unoptimized
        />
        {badge ? (
          <span className="absolute right-2 top-2 rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">{item.name}</h3>
          {subtitle ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{subtitle}</p>
          ) : null}
        </div>

        {stats.length ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-0.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{stat.label}</dt>
                <dd className="text-sm font-semibold text-foreground">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {description ? <p className="text-sm text-muted line-clamp-3">{description}</p> : null}
      </div>
    </article>
  );
}

function ForgeItemTable({ section, config }: { section: ForgeCatalogSection; config: ForgeCatalogConfig }) {
  const stats = (config.stats ?? []).slice(0, config.maxStats ?? (config.stats?.length ?? 0));
  const badgeLabel = config.badgeKey ? formatKeyLabel(config.badgeKey) : null;
  const subtitleLabel = config.subtitleKeys?.length
    ? config.subtitleKeys.length === 1
      ? formatKeyLabel(config.subtitleKeys[0])
      : "Details"
    : null;
  const descriptionLabel = config.descriptionKey ? formatKeyLabel(config.descriptionKey) : null;

  return (
    <div className="table-scroll-wrapper">
      <div className="table-scroll-inner game-copy">
        <table>
          <thead>
            <tr>
              <th className="table-col-compact">Image</th>
              <th>Name</th>
              {badgeLabel ? <th className="table-col-compact">{badgeLabel}</th> : null}
              {subtitleLabel ? <th>{subtitleLabel}</th> : null}
              {stats.map((stat) => (
                <th key={stat.key} className="table-col-compact">
                  {stat.label}
                </th>
              ))}
              {descriptionLabel ? <th className="table-col-flex">{descriptionLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => {
              const subtitle = buildSubtitle(item, config);
              const description = config.descriptionKey ? normalizeValue(item[config.descriptionKey]) : null;
              const badgeValue = config.badgeKey ? normalizeValue(item[config.badgeKey]) : null;

              return (
                <tr key={item.id} id={`item-${item.id}`}>
                  <td className="table-col-compact">
                    <div className="flex items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-muted/70 p-1.5">
                        <Image
                          src={resolveImageSrc(item.image ?? null)}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="h-18 w-18 object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold text-foreground">{item.name}</span>
                  </td>
                  {badgeLabel ? <td className="table-col-compact">{renderValue(badgeValue)}</td> : null}
                  {subtitleLabel ? <td>{renderValue(subtitle)}</td> : null}
                  {stats.map((stat) => (
                    <td key={stat.key} className="table-col-compact">
                      {renderValue(normalizeValue(item[stat.key]))}
                    </td>
                  ))}
                  {descriptionLabel ? (
                    <td className="table-col-flex">
                      {description ? (
                        <span className="text-sm text-muted line-clamp-2">{description}</span>
                      ) : (
                        renderValue(null)
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ForgeCatalogView({ sections, config }: ForgeCatalogViewProps) {
  const [view, setView] = useState<ViewMode>("cards");
  const hasItems = useMemo(
    () => sections.some((section) => section.items.length > 0),
    [sections]
  );

  if (!hasItems) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No {config.label.toLowerCase()} data has been collected yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">View</p>
        <div className="inline-flex rounded-full border border-border/60 bg-surface/70 p-1">
          {([
            { id: "cards", label: "Cards" },
            { id: "list", label: "List" }
          ] as const).map((option) => {
            const isActive = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={isActive}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-12">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-5 scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{config.groupLabel}</p>
                <h2 className="text-2xl font-semibold text-foreground">{section.label}</h2>
              </div>
              <span className="rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs font-semibold text-muted">
                {section.items.length.toLocaleString("en-US")} items
              </span>
            </div>

            {view === "cards" ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {section.items.map((item) => (
                  <ForgeItemCard key={item.id} item={item} config={config} />
                ))}
              </div>
            ) : (
              <ForgeItemTable section={section} config={config} />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}