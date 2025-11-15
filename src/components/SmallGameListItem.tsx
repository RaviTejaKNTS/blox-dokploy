import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiClock, FiMonitor, FiSmartphone, FiTablet, FiTv, FiShield, FiHash, FiUsers, FiEye, FiStar, FiThumbsUp } from "react-icons/fi";
import { TbAugmentedReality } from "react-icons/tb";
import type { GameListUniverseEntry, ListUniverseDetails } from "@/lib/db";
import { formatUpdatedLabel } from "@/lib/updated-label";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type SmallGameListItemProps = {
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
  return `${Math.round((like / total) * 100)}%`;
}

function universeTitle(universe: ListUniverseDetails): string {
  return universe.display_name || universe.name;
}

function formatAgeRating(value: string | null | undefined): string {
  if (!value) return "Not specified";
  const normalized = value.toUpperCase();
  if (normalized === "AGE_RATING_UNSPECIFIED") return "Not specified";
  const match = normalized.match(/AGE_RATING_(\d+)_PLUS/);
  if (match) return `${match[1]}+`;
  return value.replace(/_/g, " ");
}

function robloxUniverseUrl(universe: ListUniverseDetails): string {
  const placeId = universe.root_place_id ?? universe.universe_id;
  return `https://www.roblox.com/games/${placeId}`;
}

type DeviceIcon = {
  icon: ComponentType<{ className?: string }>;
  enabled?: boolean | null;
  label: string;
};

export function SmallGameListItem({ entry, rank }: SmallGameListItemProps) {
  const { universe, game } = entry;
  const coverImage = universe.icon_url || "/og-image.png";
  const primaryHref = game?.slug ? `/${game.slug}` : robloxUniverseUrl(universe);
  const updatedLabel = formatUpdatedLabel(universe.updated_at);
  const ageRating = formatAgeRating(universe.age_rating);
  const activeCodesValue = typeof game?.active_count === "number" ? game.active_count.toLocaleString() : "—";

  const devices: DeviceIcon[] = [
    { icon: FiMonitor, enabled: universe.desktop_enabled, label: "Desktop" },
    { icon: FiSmartphone, enabled: universe.mobile_enabled, label: "Mobile" },
    { icon: FiTablet, enabled: universe.tablet_enabled, label: "Tablet" },
    { icon: FiTv, enabled: universe.console_enabled, label: "Console" },
    { icon: TbAugmentedReality, enabled: universe.vr_enabled, label: "VR" }
  ];

  return (
    <article className="rounded-[var(--radius-xl)] border border-border/60 bg-surface/80 p-4 shadow-soft/50 transition hover:border-accent hover:shadow-[0_18px_35px_-30px_rgba(59,70,128,0.65)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-base font-semibold text-accent">#{rank}</span>
          <div className="min-w-0">
            <Link href={primaryHref} prefetch={false} className="line-clamp-1 text-lg font-semibold leading-tight text-foreground hover:text-accent">
              {universeTitle(universe)}
            </Link>
            <p className="text-xs text-muted">
              <FiClock className="mr-1 inline h-3 w-3 align-[-0.2em]" aria-hidden />
              {updatedLabel ?? "recently"}
            </p>
          </div>
        </div>
        <StatBar
          playing={formatNumber(universe.playing)}
          visits={formatNumber(universe.visits)}
          favorites={formatNumber(universe.favorites)}
          likeRatio={formatRatio(universe.likes, universe.dislikes)}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Link href={primaryHref} prefetch={false} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-black/20">
          <Image
            src={coverImage}
            alt={universeTitle(universe)}
            fill
            sizes="96px"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-muted">
            <div className="flex items-center gap-1">
              {devices.map(({ icon: Icon, enabled, label }) => (
                <Icon
                  key={label}
                  className={`h-4 w-4 ${enabled ? "text-accent" : "text-border"}`}
                  aria-label={label}
                  role="img"
                />
              ))}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[0.65rem] font-semibold">
              <FiShield className="h-3 w-3" />
              {ageRating}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[0.65rem] font-semibold">
              <FiHash className="h-3 w-3" />
              {activeCodesValue} codes
            </span>
          </div>
          {universe.description ? (
            <p className="text-[0.8rem] leading-snug text-muted" suppressHydrationWarning>
              {universe.description}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatBar({
  playing,
  visits,
  favorites,
  likeRatio
}: {
  playing: string;
  visits: string;
  favorites: string;
  likeRatio: string;
}) {
  const items = [
    { label: "Playing", value: playing, icon: FiUsers },
    { label: "Visits", value: visits, icon: FiEye },
    { label: "Favs", value: favorites, icon: FiStar },
    { label: "Like %", value: likeRatio, icon: FiThumbsUp }
  ];
  return (
    <div className="w-full rounded-[18px] border border-border/60 bg-background/60 px-3 py-2 text-[0.78rem] text-muted sm:max-w-full">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 py-1 text-xs font-medium text-muted whitespace-nowrap ${
              idx > 0 ? "md:before:content-['·'] md:before:px-1 md:before:text-border/80" : ""
            }`}
          >
            <item.icon className="h-4 w-4 text-muted" aria-hidden />
            <span className="text-foreground font-semibold">{item.value}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
