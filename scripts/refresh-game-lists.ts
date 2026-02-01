import "dotenv/config";
import { supabaseAdmin } from "@/lib/supabase-admin";

const METRICS = ["playing", "visits", "favorites", "likes"] as const;
type MetricKey = (typeof METRICS)[number];

type FilterConfig = {
  mode?: "filter" | "sql";
  metric?: MetricKey;
  direction?: "asc" | "desc";
  genre?: string;
  genre_l1?: string;
  genre_l2?: string;
  min_visits?: number;
  min_favorites?: number;
  min_playing?: number;
  min_likes?: number;
  limit?: number;
  include_slugs?: string[];
  exclude_slugs?: string[];
  min_updated_hours?: number;
  sql?: string;
  sql_params?: Record<string, unknown>;
};

type GameListRecord = {
  id: string;
  slug: string;
  title: string;
  list_type: "sql" | "manual" | "hybrid";
  limit_count: number;
  filter_config: FilterConfig | null;
};

type UniverseRow = {
  universe_id: number;
  root_place_id: number | null;
  name: string;
  display_name: string | null;
  slug: string | null;
  icon_url: string | null;
  playing: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  genre: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
  age_rating: string | null;
  desktop_enabled: boolean | null;
  mobile_enabled: boolean | null;
  tablet_enabled: boolean | null;
  console_enabled: boolean | null;
  vr_enabled: boolean | null;
  updated_at: string | null;
};

type RankedUniverse = UniverseRow & { metricValue: number };
type ListEntryInput = {
  universe_id: number;
  rank?: number | null;
  metricValue?: number | null;
  reason?: string | null;
  extra?: Record<string, unknown> | null;
  game_id?: string | null;
  playing?: number | null;
  visits?: number | null;
  favorites?: number | null;
  likes?: number | null;
  dislikes?: number | null;
};

type PublishedGamePreview = {
  id: string;
  slug: string;
  universe_id: number | null;
};

function parseFilterConfig(raw: unknown): FilterConfig {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const config = raw as Record<string, unknown>;
  const mode = config.mode === "sql" ? "sql" : "filter";
  const metric = typeof config.metric === "string" && METRICS.includes(config.metric as MetricKey)
    ? (config.metric as MetricKey)
    : undefined;
  const direction = config.direction === "asc" || config.direction === "desc" ? config.direction : "desc";
  const limitValue = typeof config.limit === "number" ? config.limit : undefined;

  function parseNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  const stringValue = (key: string): string | undefined => {
    const value = config[key];
    return typeof value === "string" && value.trim().length ? value.trim() : undefined;
  };

  const listValue = (key: string): string[] | undefined => {
    const value = config[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length);
    }
    return undefined;
  };

  const sqlValue = () => {
    const value = config.sql;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.toLowerCase().startsWith("select")) {
        return trimmed;
      }
    }
    return undefined;
  };

  return {
    mode,
    metric,
    direction,
    genre: stringValue("genre"),
    genre_l1: stringValue("genre_l1"),
    genre_l2: stringValue("genre_l2"),
    min_visits: parseNumber(config.min_visits),
    min_favorites: parseNumber(config.min_favorites),
    min_playing: parseNumber(config.min_playing),
    min_likes: parseNumber(config.min_likes),
    limit: limitValue,
    include_slugs: listValue("include_slugs"),
    exclude_slugs: listValue("exclude_slugs"),
    min_updated_hours: parseNumber(config.min_updated_hours),
    sql: sqlValue(),
    sql_params: typeof config.sql_params === "object" && config.sql_params !== null
      ? (config.sql_params as Record<string, unknown>)
      : undefined
  };
}

function metricForUniverse(universe: UniverseRow, metric: MetricKey | undefined): number {
  const key = metric ?? "playing";
  const value = universe[key] ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatExclusionList(values: string[]): string {
  return `(${values.map((value) => `'${value.replace(/'/g, "''")}'`).join(",")})`;
}

async function fetchRankedUniverses(config: FilterConfig, limit: number): Promise<UniverseRow[]> {
  const sb = supabaseAdmin();
  const metric = config.metric ?? "playing";
  const direction = config.direction ?? "desc";

  let query = sb
    .from("roblox_universes")
    .select(
      `universe_id,root_place_id,name,display_name,slug,icon_url,playing,visits,favorites,likes,dislikes,
       genre,genre_l1,genre_l2,age_rating,desktop_enabled,mobile_enabled,tablet_enabled,console_enabled,vr_enabled,updated_at`
    )
    .order(metric, { ascending: direction === "asc", nullsFirst: direction === "asc" });

  if (typeof config.min_playing === "number") {
    query = query.gte("playing", config.min_playing);
  }
  if (typeof config.min_visits === "number") {
    query = query.gte("visits", config.min_visits);
  }
  if (typeof config.min_favorites === "number") {
    query = query.gte("favorites", config.min_favorites);
  }
  if (typeof config.min_likes === "number") {
    query = query.gte("likes", config.min_likes);
  }
  if (typeof config.min_updated_hours === "number") {
    const cutoff = new Date(Date.now() - config.min_updated_hours * 60 * 60 * 1000).toISOString();
    query = query.gte("updated_at", cutoff);
  }

  if (config.genre) {
    query = query.eq("genre", config.genre);
  }
  if (config.genre_l1) {
    query = query.eq("genre_l1", config.genre_l1);
  }
  if (config.genre_l2) {
    query = query.eq("genre_l2", config.genre_l2);
  }

  if (config.include_slugs?.length) {
    query = query.in("slug", config.include_slugs);
  }
  if (config.exclude_slugs?.length) {
    query = query.not("slug", "in", formatExclusionList(config.exclude_slugs));
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    throw new Error(`failed to fetch ranked universes: ${error.message}`);
  }
  return (data ?? []) as UniverseRow[];
}

async function fetchSqlEntries(sql: string, limit: number): Promise<ListEntryInput[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("run_game_list_sql", { sql_text: sql, limit_count: limit });
  if (error) {
    throw new Error(`failed to run SQL for game list: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    universe_id: number;
    rank?: number | null;
    metric_value?: number | null;
    reason?: string | null;
    extra?: Record<string, unknown> | null;
    game_id?: string | null;
    playing?: number | null;
    visits?: number | null;
    favorites?: number | null;
    likes?: number | null;
    dislikes?: number | null;
  }>;

  return rows.map((row) => ({
    universe_id: row.universe_id,
    rank: row.rank ?? null,
    metricValue:
      typeof row.metric_value === "number"
        ? row.metric_value
        : row.metric_value == null
        ? null
        : Number(row.metric_value),
    reason: row.reason ?? null,
    extra: row.extra ?? null,
    game_id: row.game_id ?? null,
    playing: row.playing ?? null,
    visits: row.visits ?? null,
    favorites: row.favorites ?? null,
    likes: row.likes ?? null,
    dislikes: row.dislikes ?? null
  }));
}

async function fetchPublishedGamesForUniverses(universeIds: number[]): Promise<Map<number, PublishedGamePreview>> {
  if (!universeIds.length) return new Map();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("id,slug,universe_id")
    .eq("is_published", true)
    .in("universe_id", universeIds);

  if (error) {
    throw new Error(`failed to fetch games for universes: ${error.message}`);
  }

  const map = new Map<number, PublishedGamePreview>();
  for (const row of data ?? []) {
    if (!row?.universe_id) continue;
    if (map.has(row.universe_id)) continue;
    map.set(row.universe_id, row as PublishedGamePreview);
  }
  return map;
}

async function fetchLists(): Promise<GameListRecord[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_lists")
    .select("id,slug,title,list_type,limit_count,filter_config")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`failed to fetch game lists: ${error.message}`);
  }

  return (data ?? []) as GameListRecord[];
}

async function replaceEntries(list: GameListRecord, entries: ListEntryInput[]): Promise<void> {
  const sb = supabaseAdmin();
  const universeIds = entries.map((entry) => entry.universe_id);
  const gameMap = await fetchPublishedGamesForUniverses(universeIds);

  const payload = entries.map((entry, index) => ({
    list_id: list.id,
    universe_id: entry.universe_id,
    game_id: entry.game_id ?? gameMap.get(entry.universe_id)?.id ?? null,
    rank: entry.rank ?? index + 1,
    metric_value: entry.metricValue ?? null,
    reason: entry.reason ?? null,
    extra:
      entry.extra ??
      {
        metric: list.filter_config?.metric ?? "playing",
        metrics: {
          playing: entry.playing ?? null,
          visits: entry.visits ?? null,
          favorites: entry.favorites ?? null,
          likes: entry.likes ?? null,
          dislikes: entry.dislikes ?? null
        }
      }
  }));

  const { error: deleteError } = await sb.from("game_list_entries").delete().eq("list_id", list.id);
  if (deleteError) {
    throw new Error(`failed to clear entries for ${list.slug}: ${deleteError.message}`);
  }

  if (payload.length) {
    const { error: insertError } = await sb.from("game_list_entries").insert(payload);
    if (insertError) {
      throw new Error(`failed to insert entries for ${list.slug}: ${insertError.message}`);
    }
  }

  const { error: updateError } = await sb
    .from("game_lists")
    .update({ refreshed_at: new Date().toISOString() })
    .eq("id", list.id);
  if (updateError) {
    throw new Error(`failed to mark refreshed_at for ${list.slug}: ${updateError.message}`);
  }
}

async function buildEntriesForList(list: GameListRecord): Promise<ListEntryInput[]> {
  if (list.list_type === "manual") {
    return [];
  }

  const config = parseFilterConfig(list.filter_config);
  const limit = config.limit ?? list.limit_count ?? 50;
  if (config.mode === "sql") {
    if (!config.sql) {
      throw new Error(`filter_config.mode is "sql" but no sql provided for list ${list.slug}`);
    }
    return fetchSqlEntries(config.sql, limit);
  }
  const universes = await fetchRankedUniverses(config, limit);

  return universes.map((universe) => ({
    ...universe,
    metricValue: metricForUniverse(universe, config.metric ?? "playing")
  }));
}

async function main() {
  const lists = await fetchLists();

  if (!lists.length) {
    console.log("No published game lists found. Nothing to refresh.");
    return;
  }

  let processed = 0;

  for (const list of lists) {
    if (list.list_type === "manual") {
      console.log(`Skipping manual list ${list.slug}`);
      continue;
    }

    try {
      const entries = await buildEntriesForList(list);
      await replaceEntries(list, entries);
      processed += 1;
      console.log(`Refreshed ${list.slug} with ${entries.length} entries.`);
    } catch (error) {
      console.error(`Failed to refresh ${list.slug}:`, error);
    }
  }

  console.log(`Completed refresh for ${processed} list(s).`);
}

main().catch((error) => {
  console.error("Refresh failed:", error);
  process.exit(1);
});
