"use client";

import { FormEvent, useMemo, useState } from "react";

type RobloxType = "user" | "group" | "experience" | "asset" | "bundle" | "gamepass" | "badge";
type SourceType = "roblox" | "supabase" | "mixed" | "none";

type ResolverResponseOk = {
  ok: true;
  type: RobloxType;
  ids: Record<string, number>;
  openUrl: string;
  details: Record<string, unknown> | null;
  imageUrl?: string | null;
  source: SourceType;
  warnings: string[];
};

type ResolverResponseError = {
  ok: false;
  error: { message: string; hint?: string };
  warnings?: string[];
};

type ResolverResponse = ResolverResponseOk | ResolverResponseError;

type InputDetection =
  | { kind: "empty" }
  | { kind: "numeric"; id: number }
  | { kind: "url"; type: RobloxType; ids: Record<string, number> }
  | { kind: "unknown"; reason: "invalid-url" | "unsupported-url" };

const TYPE_OPTIONS: Array<{ value: RobloxType; label: string }> = [
  { value: "experience", label: "Experience (game/place)" },
  { value: "user", label: "User" },
  { value: "group", label: "Group / Community" },
  { value: "asset", label: "Catalog asset" },
  { value: "bundle", label: "Bundle" },
  { value: "gamepass", label: "Game pass" },
  { value: "badge", label: "Badge" }
];

const TYPE_LABELS: Record<RobloxType, string> = {
  user: "User",
  group: "Group / Community",
  experience: "Experience",
  asset: "Catalog asset",
  bundle: "Bundle",
  gamepass: "Game pass",
  badge: "Badge"
};

const SOURCE_LABELS: Record<SourceType, string> = {
  roblox: "Roblox live data",
  supabase: "Supabase snapshot",
  mixed: "Roblox + Supabase",
  none: "No data"
};

const ID_ORDER = ["placeId", "universeId", "userId", "groupId", "assetId", "bundleId", "gamePassId", "badgeId"];
const ID_LABELS: Record<string, string> = {
  placeId: "Place ID",
  universeId: "Universe ID",
  userId: "User ID",
  groupId: "Group ID",
  assetId: "Asset ID",
  bundleId: "Bundle ID",
  gamePassId: "Game Pass ID",
  badgeId: "Badge ID"
};

function parseRobloxUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function toInt(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSearchParamInt(searchParams: URLSearchParams, keys: string[]): number | null {
  for (const [key, value] of searchParams.entries()) {
    if (keys.includes(key.toLowerCase())) {
      return toInt(value);
    }
  }
  return null;
}

function extractId(segment?: string | null): number | null {
  if (!segment) return null;
  const match = segment.match(/\d+/);
  return match ? toInt(match[0]) : null;
}

function buildIds(values: Record<string, number | null | undefined>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === "number")) as Record<
    string,
    number
  >;
}

function detectFromUrl(url: URL): { type: RobloxType; ids: Record<string, number> } | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host.endsWith("roblox.com")) return null;

  const path = url.pathname.split("/").filter(Boolean);
  const first = path[0]?.toLowerCase() ?? "";
  const second = path[1];

  if (first === "users") {
    const userId = extractId(second) ?? getSearchParamInt(url.searchParams, ["userid"]);
    if (userId) return { type: "user", ids: { userId } };
  }

  if (first === "groups" || first === "communities") {
    const groupId = extractId(second) ?? getSearchParamInt(url.searchParams, ["groupid"]);
    if (groupId) return { type: "group", ids: { groupId } };
  }

  if (first === "games" || first === "game") {
    const placeId = extractId(second) ?? getSearchParamInt(url.searchParams, ["placeid"]);
    const universeId = getSearchParamInt(url.searchParams, ["universeid"]);
    if (placeId || universeId) {
      return { type: "experience", ids: buildIds({ placeId, universeId }) };
    }
  }

  if (first === "catalog" || first === "library") {
    const assetId = extractId(second) ?? getSearchParamInt(url.searchParams, ["assetid"]);
    if (assetId) return { type: "asset", ids: { assetId } };
  }

  if (first === "bundles") {
    const bundleId = extractId(second) ?? getSearchParamInt(url.searchParams, ["bundleid"]);
    if (bundleId) return { type: "bundle", ids: { bundleId } };
  }

  if (first === "badges") {
    const badgeId = extractId(second) ?? getSearchParamInt(url.searchParams, ["badgeid"]);
    if (badgeId) return { type: "badge", ids: { badgeId } };
  }

  if (first === "game-pass" || first === "gamepass" || first === "game-passes") {
    const gamePassId = extractId(second) ?? getSearchParamInt(url.searchParams, ["gamepassid", "passid"]);
    if (gamePassId) return { type: "gamepass", ids: { gamePassId } };
  }

  const placeId = getSearchParamInt(url.searchParams, ["placeid"]);
  const universeId = getSearchParamInt(url.searchParams, ["universeid"]);
  if (placeId || universeId) {
    return { type: "experience", ids: buildIds({ placeId, universeId }) };
  }

  return null;
}

function detectInput(raw: string): InputDetection {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };
  if (/^\d+$/.test(trimmed)) {
    return { kind: "numeric", id: Number.parseInt(trimmed, 10) };
  }

  const url = parseRobloxUrl(trimmed);
  if (!url) return { kind: "unknown", reason: "invalid-url" };
  const detected = detectFromUrl(url);
  if (!detected) return { kind: "unknown", reason: "unsupported-url" };
  return { kind: "url", type: detected.type, ids: detected.ids };
}

function prettyLabel(key: string): string {
  const spaced = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed) && value.includes("T")) {
      return new Date(parsed).toLocaleString();
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).filter(Boolean).join(", ");
  }
  return JSON.stringify(value);
}

function getStringField(details: Record<string, unknown> | null, key: string): string | null {
  const value = details?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed", error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-surface px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/30"
      aria-label={`Copy ${value}`}
    >
      <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {copied ? <path d="m5 13 4 4L19 7" /> : <rect x="9" y="9" width="13" height="13" rx="2" />}
        {!copied ? <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8" /> : null}
      </svg>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function RobloxIdExtractorClient() {
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState<RobloxType>("experience");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolverResponseOk | null>(null);
  const detection = useMemo(() => detectInput(input), [input]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a Roblox link or ID.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (detection.kind === "numeric") {
        params.set("type", selectedType);
      }
      const response = await fetch(`/api/roblox-id-extractor?${params.toString()}`);
      const payload = (await response.json()) as ResolverResponse;

      if (!response.ok || !payload.ok) {
        if (!payload.ok) {
          const hint = payload.error.hint ? ` ${payload.error.hint}` : "";
          setError(`${payload.error.message}${hint}`);
        } else {
          setError("Failed to resolve this link.");
        }
        setResult(null);
        return;
      }

      setResult(payload);
    } catch (err) {
      console.error("Extractor failed", err);
      setError("Failed to reach the extractor. Try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const idEntries = useMemo(() => {
    if (!result) return [];
    return ID_ORDER.filter((key) => result.ids[key] !== undefined).map((key) => ({
      key,
      label: ID_LABELS[key] ?? prettyLabel(key),
      value: String(result.ids[key])
    }));
  }, [result]);

  const detailEntries = useMemo(() => {
    if (!result?.details) return [];
    return Object.entries(result.details)
      .filter(([key]) => key !== "name" && key !== "displayName")
      .map(([key, value]) => ({ key, label: prettyLabel(key), value: formatValue(value) }))
      .filter((entry) => entry.value);
  }, [result]);

  const nameBlock = useMemo(() => {
    if (!result) return { primary: null, secondary: null };
    const details = result.details ?? null;
    const displayName = getStringField(details, "displayName");
    const name = getStringField(details, "name");
    let primary = displayName ?? name;
    let secondary: string | null = null;
    if (displayName && name && displayName !== name) {
      secondary = displayName === primary ? `Username: ${name}` : `Display name: ${displayName}`;
    }
    if (!primary) {
      primary = `Unknown ${TYPE_LABELS[result.type]}`;
    }
    return { primary, secondary };
  }, [result]);

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Paste a Roblox link or ID</h2>
          <p className="text-sm text-muted">
            Supports users, groups, experiences, catalog items, bundles, game passes, and badges. For best results, paste the full URL.
          </p>
        </div>

        <label className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-4 py-3 shadow-soft">
          <span className="text-sm font-semibold text-foreground">Roblox link or ID</span>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="w-full rounded-md border border-border/60 bg-white/5 px-3 py-2 text-base text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-black/10"
            placeholder="https://www.roblox.com/games/12345/..."
          />
        </label>

        {detection.kind === "url" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">Detected: {TYPE_LABELS[detection.type]}</span>
            {Object.entries(detection.ids).map(([key, value]) => (
              <span key={key} className="chip">
                {ID_LABELS[key] ?? prettyLabel(key)}: {value}
              </span>
            ))}
          </div>
        ) : null}

        {detection.kind === "numeric" ? (
          <div className="rounded-2xl border border-border/60 bg-surface-muted px-4 py-4 text-sm text-muted">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Numeric ID detected</p>
                <p className="text-xs text-muted">Select the ID type so we can resolve it correctly.</p>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">ID type</span>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value as RobloxType)}
                  className="rounded-md border border-border/60 bg-white/5 px-3 py-2 text-sm text-foreground outline-none ring-2 ring-transparent transition focus:ring-accent/50 dark:bg-black/10"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {detection.kind === "unknown" ? (
          <div className="rounded-2xl border border-border/60 bg-surface-muted px-4 py-3 text-xs text-muted">
            {detection.reason === "invalid-url"
              ? "That doesn’t look like a valid Roblox URL. Try pasting the full link or a numeric ID."
              : "We couldn’t detect a supported Roblox link. Paste the full Roblox URL for best results."}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Extracting..." : "Extract IDs"}
        </button>
      </form>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="panel space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Detected</p>
              <h3 className="text-2xl font-semibold text-foreground">{TYPE_LABELS[result.type]}</h3>
              <p className="text-sm text-muted">Source: {SOURCE_LABELS[result.source]}</p>
            </div>
            <a
              href={result.openUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-border/60 bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              Open on Roblox
            </a>
          </div>

          {result.imageUrl ? (
            <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface-muted p-4">
              <img
                src={result.imageUrl}
                alt={`${TYPE_LABELS[result.type]} thumbnail`}
                className="h-20 w-20 rounded-xl object-cover"
                loading="lazy"
              />
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-foreground">{nameBlock.primary}</p>
                {nameBlock.secondary ? <p className="text-sm text-muted">{nameBlock.secondary}</p> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-surface-muted px-4 py-4">
              <p className="text-2xl font-semibold text-foreground">{nameBlock.primary}</p>
              {nameBlock.secondary ? <p className="mt-1 text-sm text-muted">{nameBlock.secondary}</p> : null}
            </div>
          )}

          {result.warnings?.length ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <ul className="space-y-1">
                {result.warnings.map((warning, idx) => (
                  <li key={`${warning}-${idx}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {idEntries.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2 rounded-full border border-border/50 bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                <span>{entry.label}:</span>
                <span className="font-mono text-[0.85rem]">{entry.value}</span>
                <CopyButton value={entry.value} />
              </div>
            ))}
          </div>

          {detailEntries.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {detailEntries.map((entry) => (
                <div key={entry.key} className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{entry.label}</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{entry.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No extra details available for this ID.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
