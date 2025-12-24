import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { MusicCoverImage } from "@/components/MusicCoverImage";
import { PagePagination } from "@/components/PagePagination";
import { supabaseAdmin } from "@/lib/supabase";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;
export const PAGE_SIZE = 24;

const BASE_PATH = "/catalog/roblox-music-ids";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
const GENRE_OPTIONS = [
  { value: "", label: "All genres" },
  { value: "electronic", label: "Electronic" },
  { value: "ambient", label: "Ambient" },
  { value: "pop", label: "Pop" },
  { value: "hip hop", label: "Hip Hop" },
  { value: "indie", label: "Indie" },
  { value: "funk", label: "Funk" },
  { value: "rock", label: "Rock" },
  { value: "lofi", label: "Lofi" },
  { value: "jazz", label: "Jazz" },
  { value: "acoustic", label: "Acoustic" },
  { value: "country", label: "Country" },
  { value: "metal", label: "Metal" },
  { value: "r&b", label: "R&B" },
  { value: "rap", label: "Rap" },
  { value: "folk", label: "Folk" },
  { value: "holiday", label: "Holiday" },
  { value: "classical", label: "Classical" },
  { value: "world", label: "World" }
];
const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "music_discovery_top_songs", label: "Top songs" },
  { value: "toolbox_music_search", label: "Creator Store" }
];
const SORT_OPTIONS = [
  { value: "rank", label: "Top ranked" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title A-Z" },
  { value: "artist", label: "Artist A-Z" },
  { value: "duration", label: "Longest duration" },
  { value: "id", label: "Highest ID" }
];

export const metadata: Metadata = {
  title: `Roblox Music IDs | ${SITE_NAME}`,
  description: CATALOG_DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: `Roblox Music IDs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Music IDs | ${SITE_NAME}`,
    description: CATALOG_DESCRIPTION
  }
};

type MusicRow = {
  asset_id: number;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number | null;
  album_art_asset_id: number | null;
  rank: number | null;
  source: string | null;
  last_seen_at: string | null;
};

type PageData = {
  songs: MusicRow[];
  total: number;
  totalPages: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

export type MusicIdFilters = {
  q: string;
  genre: string;
  source: string;
  sort: string;
};

function getParam(searchParams: SearchParams | undefined, key: string): string {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeParamValue(value: string): string {
  const decoded = value.replace(/\+/g, " ");
  return decoded.trim().toLowerCase();
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeOption(value: string, options: Array<{ value: string }>, fallback: string): string {
  const normalized = normalizeParamValue(value);
  const match = options.find((option) => normalizeParamValue(option.value) === normalized);
  return match ? match.value : fallback;
}

export function parseMusicIdFilters(searchParams: SearchParams | undefined): MusicIdFilters {
  const q = sanitizeSearchTerm(getParam(searchParams, "q"));
  const genre = normalizeOption(getParam(searchParams, "genre"), GENRE_OPTIONS, "");
  const source = normalizeOption(getParam(searchParams, "source"), SOURCE_OPTIONS, "");
  const sort = normalizeOption(getParam(searchParams, "sort"), SORT_OPTIONS, "rank");
  return { q, genre, source, sort };
}

function buildQueryString(filters: MusicIdFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.source) params.set("source", filters.source);
  if (filters.sort && filters.sort !== "rank") params.set("sort", filters.sort);
  return params.toString();
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function buildThumbnailUrl(song: MusicRow): string {
  if (!song.album_art_asset_id) return "";
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${song.album_art_asset_id}&width=420&height=420&format=png`;
}

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/library/${assetId}`;
}

function GenreCarousel({ filters }: { filters: MusicIdFilters }) {
  const activeGenre = filters.genre ?? "";
  return (
    <section className="rounded-2xl border border-border/60 bg-surface/60 p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Genres</p>
          <p className="text-lg font-semibold text-foreground">Pick a vibe</p>
        </div>
        <span className="text-xs text-muted">Scroll to explore</span>
      </div>
      <div className="mt-4 -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GENRE_OPTIONS.map((option) => {
          const isActive = activeGenre === option.value;
          const query = buildQueryString({ ...filters, genre: option.value });
          const href = query ? `${BASE_PATH}?${query}` : BASE_PATH;
          return (
            <a
              key={option.value || "all"}
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={`group relative min-w-[150px] snap-start overflow-hidden rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? "border-accent bg-gradient-to-br from-accent/15 via-background to-surface shadow-soft"
                  : "border-border/60 bg-gradient-to-br from-background/80 via-surface/70 to-surface-muted/60 hover:-translate-y-0.5 hover:border-accent/70"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-1 ${
                  isActive ? "bg-accent" : "bg-accent/30 group-hover:bg-accent/60"
                }`}
              />
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  <span>Genre</span>
                  {isActive ? (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Active
                    </span>
                  ) : null}
                </div>
                <span className="text-base font-semibold text-foreground">{option.label}</span>
                <span className="text-xs text-muted">Explore tracks</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

async function loadPage(pageNumber: number, filters: MusicIdFilters): Promise<PageData> {
  const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const offset = (safePage - 1) * PAGE_SIZE;

  const supabase = supabaseAdmin();
  let query = supabase
    .from("roblox_music_ids")
    .select("asset_id, title, artist, album, genre, duration_seconds, album_art_asset_id, rank, source, last_seen_at", {
      count: "exact"
    });

  if (filters.q) {
    const like = `%${filters.q}%`;
    query = query.or(`title.ilike.${like},artist.ilike.${like},album.ilike.${like}`);
  }
  if (filters.genre) {
    const genrePattern = filters.genre.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
    query = query.ilike("genre", `%${genrePattern}%`);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }

  switch (filters.sort) {
    case "newest":
      query = query.order("last_seen_at", { ascending: false, nullsFirst: false });
      break;
    case "title":
      query = query.order("title", { ascending: true }).order("asset_id", { ascending: true });
      break;
    case "artist":
      query = query.order("artist", { ascending: true }).order("title", { ascending: true });
      break;
    case "duration":
      query = query.order("duration_seconds", { ascending: false, nullsFirst: false }).order("asset_id", { ascending: true });
      break;
    case "id":
      query = query.order("asset_id", { ascending: false });
      break;
    default:
      query = query.order("rank", { ascending: true, nullsFirst: false }).order("last_seen_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Failed to load Roblox music IDs", error);
    return { songs: [], total: 0, totalPages: 1 };
  }

  const total = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { songs: (data ?? []) as MusicRow[], total, totalPages };
}

function RobloxMusicIdsPageView({
  songs,
  total,
  totalPages,
  currentPage,
  showHero,
  filters
}: {
  songs: MusicRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  filters: MusicIdFilters;
}) {
  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const queryString = buildQueryString(filters);

  return (
    <div className="space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Catalog</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Roblox music IDs</h1>
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Browse every Roblox music ID we have collected, complete with quick previews and direct play links.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
            <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
              {total} songs tracked
            </span>
            {refreshedLabel ? (
              <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
                Updated {refreshedLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">24 per page</span>
          </div>
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Catalog</p>
          <h1 className="text-3xl font-semibold text-foreground">Roblox music IDs</h1>
          {refreshedLabel ? (
            <p className="text-sm text-muted">
              Updated {refreshedLabel} · Page {currentPage} of {totalPages}
            </p>
          ) : null}
        </header>
      )}

      <GenreCarousel filters={filters} />

      <form
        action={BASE_PATH}
        method="get"
        className="rounded-2xl border border-border/60 bg-surface p-5 shadow-soft"
      >
        <input type="hidden" name="genre" value={filters.genre} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Search
            <input
              type="text"
              name="q"
              defaultValue={filters.q}
              placeholder="Title, artist, or album"
              className="h-11 rounded-lg border border-border/60 bg-background px-3 text-sm font-normal text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Source
            <select
              name="source"
              defaultValue={filters.source}
              className="h-11 rounded-lg border border-border/60 bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Sort by
            <select
              name="sort"
              defaultValue={filters.sort}
              className="h-11 rounded-lg border border-border/60 bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
          >
            Apply filters
          </button>
          <a
            href={BASE_PATH}
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-6 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Reset
          </a>
        </div>
      </form>

      {songs.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {songs.map((song) => {
            const durationLabel = formatDuration(song.duration_seconds);
            return (
              <article
                key={song.asset_id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl"
              >
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-inner">
                      <MusicCoverImage
                        src={buildThumbnailUrl(song)}
                        alt={`${song.title} Roblox music`}
                        sizes="80px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-lg font-semibold leading-snug text-foreground line-clamp-2">{song.title}</h2>
                      <div className="space-y-1 text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Artist</span>
                          <span className="font-semibold text-foreground">{song.artist}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Album</span>
                          <span className="text-foreground">{song.album ?? "Single / Unknown"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                      <span>Music ID</span>
                      <span className="font-mono text-[0.82rem]">{song.asset_id}</span>
                      <CopyCodeButton code={String(song.asset_id)} tone="surface" size="sm" />
                    </div>
                    {song.rank ? (
                      <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                        Top #{song.rank}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Duration</span>
                      <span className="font-semibold text-foreground">{durationLabel ?? "—"}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Genre</span>
                      <span className="font-semibold text-foreground">{song.genre ?? "—"}</span>
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    <a
                      href={buildRobloxUrl(song.asset_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
                    >
                      Play on Roblox
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No music IDs have been collected yet. Check back soon.
        </div>
      )}

      <PagePagination basePath={BASE_PATH} currentPage={currentPage} totalPages={totalPages} query={queryString} />
    </div>
  );
}

export default async function RobloxMusicIdsPage({ searchParams }: { searchParams?: SearchParams }) {
  const filters = parseMusicIdFilters(searchParams);
  const { songs, total, totalPages } = await loadPage(1, filters);

  return (
    <RobloxMusicIdsPageView
      songs={songs}
      total={total}
      totalPages={totalPages}
      currentPage={1}
      showHero
      filters={filters}
    />
  );
}

export async function loadRobloxMusicIdsPageData(page: number, filters: MusicIdFilters) {
  return loadPage(page, filters);
}

export function renderRobloxMusicIdsPage(props: Parameters<typeof RobloxMusicIdsPageView>[0]) {
  return <RobloxMusicIdsPageView {...props} />;
}
