import type { ComponentType, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUsers, FiEye, FiStar, FiThumbsUp, FiClock, FiMonitor, FiSmartphone, FiTablet, FiTv, FiShield, FiHash } from "react-icons/fi";
import { TbAugmentedReality } from "react-icons/tb";
import type { GameListUniverseEntry, ListUniverseDetails } from "@/lib/db";
import { formatUpdatedLabel } from "@/lib/updated-label";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type GameListItemProps = {
  entry: GameListUniverseEntry;
  rank: number;
  metricLabel?: string | null;
};

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1000) return value.toLocaleString();
  return numberFormatter.format(value);
}

function formatRatio(likes: number | null | undefined, dislikes: number | null | undefined): string {
  const like = typeof likes === "number" ? likes : 0;
  const dislike = typeof dislikes === "number" ? dislikes : 0;
  const total = like + dislike;
  if (total <= 0) return "—";
  const percent = Math.round((like / total) * 100);
  return `${percent}%`;
}

function DeviceBadge({ label, icon: Icon, enabled }: { label: string; icon: ComponentType<{ className?: string }>; enabled?: boolean | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        enabled ? "border-accent/60 text-accent" : "border-border/60 text-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

function ExternalLinkWrapper({
  href,
  children,
  className
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return (
      <Link href={href} prefetch={false} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function universeTitle(universe: ListUniverseDetails): string {
  return universe.display_name || universe.name;
}

function formatAgeRating(value: string | null | undefined): string {
  if (!value) return "Not specified";
  const normalized = value.toUpperCase();
  if (normalized === "AGE_RATING_UNSPECIFIED") return "Not specified";
  const match = normalized.match(/AGE_RATING_(\d+)_PLUS/);
  if (match) {
    return `${match[1]}+`;
  }
  return value.replace(/_/g, " ");
}

function robloxUniverseUrl(universe: ListUniverseDetails): string {
  const placeId = universe.root_place_id ?? universe.universe_id;
  return `https://www.roblox.com/games/${placeId}`;
}

export function GameListItem({ entry, rank, metricLabel }: GameListItemProps) {
  const { universe, game } = entry;
  const coverImage = universe.icon_url || "/og-image.png";
  const ageRating = formatAgeRating(universe.age_rating);
  const updatedLabel = formatUpdatedLabel(universe.updated_at);
  const metricChip = entry.metric_value != null ? `${formatNumber(entry.metric_value)}${metricLabel ? ` ${metricLabel}` : ""}` : null;
  const primaryHref = game?.slug ? `/${game.slug}` : robloxUniverseUrl(universe);
  const activeCodesValue =
    typeof game?.active_count === "number" ? game.active_count.toLocaleString() : "—";

  return (
    <article className="rounded-[var(--radius-xl)] border border-border/60 bg-surface/80 p-5 shadow-soft transition hover:border-accent hover:shadow-[0_24px_45px_-35px_rgba(59,70,128,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-base font-bold text-accent">#{rank}</span>
          <div>
            <ExternalLinkWrapper
              href={primaryHref}
              className="text-lg font-semibold text-foreground transition hover:text-accent"
            >
              {universeTitle(universe)}
            </ExternalLinkWrapper>
            <p className="text-xs text-muted">
              Updated <FiClock className="inline h-3 w-3 align-[-0.2em] text-muted/70" aria-hidden /> {updatedLabel ?? "recently"}
            </p>
          </div>
        </div>
        {metricChip ? <span className="rounded-full bg-border/20 px-3 py-1 text-xs font-semibold text-foreground">{metricChip}</span> : null}
      </div>

      <div className="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={FiUsers} label="Playing Now" value={universe.playing} />
          <Stat icon={FiEye} label="Visits" value={universe.visits} />
          <Stat icon={FiStar} label="Favorites" value={universe.favorites} />
          <Stat icon={FiThumbsUp} label="Like Ratio" valueLabel={formatRatio(universe.likes, universe.dislikes)} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px,1fr]">
          <ExternalLinkWrapper
            href={primaryHref}
            className="group relative block w-full max-w-[360px] lg:max-w-none"
          >
            <div className="relative aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-black/20">
              <Image
                src={coverImage}
                alt={universeTitle(universe)}
                fill
                sizes="(min-width: 1024px) 220px, 80vw"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
          </ExternalLinkWrapper>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DeviceBadge label="Desktop" icon={FiMonitor} enabled={universe.desktop_enabled} />
              <DeviceBadge label="Mobile" icon={FiSmartphone} enabled={universe.mobile_enabled} />
              <DeviceBadge label="Tablet" icon={FiTablet} enabled={universe.tablet_enabled} />
              <DeviceBadge label="Console" icon={FiTv} enabled={universe.console_enabled} />
              <DeviceBadge label="VR" icon={TbAugmentedReality} enabled={universe.vr_enabled} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
                <FiShield className="h-3 w-3" />
                {ageRating}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1">
                <FiHash className="h-3 w-3" />
                {activeCodesValue} active codes
              </span>
            </div>

            {universe.description ? (
              <p className="text-sm text-muted" suppressHydrationWarning>
                {universe.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueLabel,
  subtle
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: number | null;
  valueLabel?: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-border/60 bg-background/40 px-3 py-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-border/40 text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
        <p
          className={`text-lg font-semibold text-foreground ${
            subtle ? "text-muted" : ""
          }`}
        >
          {valueLabel ?? formatNumber(value ?? null)}
        </p>
      </div>
    </div>
  );
}
