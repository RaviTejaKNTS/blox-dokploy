import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_AUTHOR_ID } from "./constants";

export type Author = {
  id: string;
  name: string;
  slug: string;
  gravatar_email: string | null;
  avatar_url: string | null;
  bio_md: string | null;
  twitter: string | null;
  youtube: string | null;
  website: string | null;
  facebook: string | null;
  linkedin: string | null;
  instagram: string | null;
  roblox: string | null;
  discord: string | null;
  created_at: string;
  updated_at: string;
};

export type Game = {
  id: string;
  name: string;
  slug: string;
  author_id: string | null;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  roblox_link?: string | null;
  community_link?: string | null;
  discord_link?: string | null;
  twitter_link?: string | null;
  youtube_link?: string | null;
  expired_codes: string[] | null;
  cover_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  intro_md: string | null;
  redeem_md: string | null;
  troubleshoot_md: string | null;
  rewards_md: string | null;
  about_game_md: string | null;
  description_md: string | null;
  universe_id: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type GameWithAuthor = Game & {
  author: Author | null;
};

export type RobloxUniverseInfo = {
  universe_id: number;
  name: string | null;
  display_name: string | null;
  creator_name: string | null;
  creator_id: number | null;
  creator_type: string | null;
  social_links: Record<string, unknown> | null;
};

export type Article = {
  id: string;
  title: string;
  slug: string;
  content_md: string;
  cover_image: string | null;
  author_id: string | null;
  universe_id: number | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  meta_description: string | null;
};

export type UniverseSummary = {
  universe_id: number;
  slug: string | null;
  display_name: string | null;
  name: string | null;
};

export type ArticleWithRelations = Article & {
  author: Author | null;
  universe: UniverseSummary | null;
};

export type ListUniverseDetails = {
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
  age_rating: string | null;
  desktop_enabled: boolean | null;
  mobile_enabled: boolean | null;
  tablet_enabled: boolean | null;
  console_enabled: boolean | null;
  vr_enabled: boolean | null;
  updated_at: string | null;
  description: string | null;
  game_description_md: string | null;
};

export type GameList = {
  id: string;
  slug: string;
  title: string;
  hero_md: string | null;
  intro_md: string | null;
  outro_md: string | null;
  meta_title: string | null;
  meta_description: string | null;
  cover_image: string | null;
  list_type: "sql" | "manual" | "hybrid";
  filter_config: Record<string, unknown> | null;
  limit_count: number;
  is_published: boolean;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GameListEntry = {
  list_id: string;
  universe_id: number;
  game_id: string | null;
  rank: number;
  metric_value: number | null;
  reason: string | null;
  extra: Record<string, unknown> | null;
};

type GamePreview = Pick<Game, "id" | "slug" | "name" | "universe_id"> & {
  active_count?: number | null;
};

export type GameListUniverseEntry = GameListEntry & {
  universe: ListUniverseDetails;
  game: GamePreview | null;
};

export type UniverseListBadge = {
  list_id: string;
  list_slug: string;
  list_title: string;
  rank: number;
};

export type Code = {
  id: string;
  game_id: string;
  code: string;
  status: "active"|"expired"|"check";
  rewards_text: string | null;
  level_requirement: number | null;
  is_new: boolean | null;
  posted_online: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export async function listPublishedGames(): Promise<Game[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("*")
    .eq("is_published", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Game[];
}

export async function listAuthors(): Promise<Author[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("authors")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Author[];
}

function articleSelectFields() {
  return `*, author:authors(id,name,slug,avatar_url,gravatar_email,bio_md,twitter,youtube,website,facebook,linkedin,instagram,roblox,discord,created_at,updated_at), universe:roblox_universes(universe_id,slug,display_name,name)`;
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Author) || null;
}

type GameSummaryFields = Pick<Game, "id" | "name" | "slug" | "cover_image" | "created_at" | "updated_at" | "universe_id">;

export type GameWithCounts = GameSummaryFields & {
  active_count: number;
  latest_code_first_seen_at: string | null;
  content_updated_at: string | null;
};


export async function listAllGames(): Promise<Game[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Game[];
}

const ACTIVE_CODE_BATCH_SIZE = 50;
const ACTIVE_CODE_PAGE_SIZE = 1000;

async function fetchActiveCodeStats(
  sb: ReturnType<typeof supabaseAdmin>,
  gameIds: string[]
): Promise<{
  counts: Map<string, number>;
  latestFirstSeenMap: Map<string, string | null>;
}> {
  const counts = new Map<string, number>();
  const latestFirstSeenMap = new Map<string, string | null>();

  for (let offset = 0; offset < gameIds.length; offset += ACTIVE_CODE_BATCH_SIZE) {
    const batchIds = gameIds.slice(offset, offset + ACTIVE_CODE_BATCH_SIZE);
    let from = 0;

    while (true) {
      const to = from + ACTIVE_CODE_PAGE_SIZE - 1;
      const { data, error } = await sb
        .from("codes")
        .select("game_id, status, first_seen_at")
        .in("game_id", batchIds)
        .order("first_seen_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as {
        game_id: string;
        status: "active" | "expired" | "check";
        first_seen_at: string | null;
      }[];

      for (const row of rows) {
        if (row.status === "active") {
          counts.set(row.game_id, (counts.get(row.game_id) ?? 0) + 1);
        }

        if (!latestFirstSeenMap.has(row.game_id)) {
          latestFirstSeenMap.set(row.game_id, row.first_seen_at ?? null);
        }
      }

      if (rows.length < ACTIVE_CODE_PAGE_SIZE) {
        break;
      }
      from += ACTIVE_CODE_PAGE_SIZE;
    }
  }

  return { counts, latestFirstSeenMap };
}

function buildGamesWithActiveCounts(
  gameList: GameSummaryFields[],
  counts: Map<string, number>,
  latestFirstSeenMap: Map<string, string | null>
): GameWithCounts[] {
  return gameList.map<GameWithCounts>((g) => {
    const latestFirstSeen = latestFirstSeenMap.get(g.id) ?? null;
    const updatedAtTime = Date.parse(g.updated_at ?? "");
    const latestFirstSeenTime = latestFirstSeen ? Date.parse(latestFirstSeen) : NaN;
    const hasLatestFirstSeen = Number.isFinite(latestFirstSeenTime);
    const hasUpdatedAt = Number.isFinite(updatedAtTime);
    let contentUpdatedAt: string | null = g.updated_at ?? null;
    if (hasLatestFirstSeen && hasUpdatedAt) {
      contentUpdatedAt = latestFirstSeenTime > updatedAtTime ? latestFirstSeen : g.updated_at ?? latestFirstSeen;
    } else if (hasLatestFirstSeen) {
      contentUpdatedAt = latestFirstSeen;
    }

    return {
      ...g,
      active_count: counts.get(g.id) || 0,
      latest_code_first_seen_at: latestFirstSeen,
      content_updated_at: contentUpdatedAt ?? g.updated_at ?? null
    };
  });
}

export async function listGamesWithActiveCounts(): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data: games, error: gamesError } = await sb
    .from("games")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (gamesError) throw gamesError;

  const gameList = (games ?? []) as GameSummaryFields[];
  if (gameList.length === 0) {
    return [];
  }
  const gameIds = gameList.map((g) => g.id);

  const { counts, latestFirstSeenMap } = await fetchActiveCodeStats(sb, gameIds);

  const toTimestamp = (value: string | null | undefined): number => {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  const withCounts = buildGamesWithActiveCounts(gameList, counts, latestFirstSeenMap);

  return withCounts
    .sort((a, b) => {
      const aTime = toTimestamp(a.latest_code_first_seen_at ?? a.updated_at);
      const bTime = toTimestamp(b.latest_code_first_seen_at ?? b.updated_at);
      return bTime - aTime;
    });
}

export async function listGamesWithActiveCountsForIds(gameIds: string[]): Promise<GameWithCounts[]> {
  if (!gameIds.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(gameIds));
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id")
    .eq("is_published", true)
    .in("id", uniqueIds);
  if (error) throw error;

  const gameList = (data ?? []) as GameSummaryFields[];
  if (!gameList.length) {
    return [];
  }

  const { counts, latestFirstSeenMap } = await fetchActiveCodeStats(sb, uniqueIds);
  const withCounts = buildGamesWithActiveCounts(gameList, counts, latestFirstSeenMap);
  const map = new Map(withCounts.map((game) => [game.id, game]));

  return gameIds.map((id) => map.get(id)).filter((game): game is GameWithCounts => Boolean(game));
}

export async function listPublishedGameLists(): Promise<GameList[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_lists")
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameList[];
}

export async function getGameListMetadata(slug: string): Promise<GameList | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_lists")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data as GameList) ?? null;
}

export async function getGameListBySlug(
  slug: string
): Promise<{ list: GameList; entries: GameListUniverseEntry[] } | null> {
  const sb = supabaseAdmin();
  const { data: listData, error: listError } = await sb
    .from("game_lists")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (listError) throw listError;
  if (!listData) return null;
  const list = listData as GameList;

  const { data: entriesData, error: entriesError } = await sb
    .from("game_list_entries")
    .select("list_id,universe_id,game_id,rank,metric_value,reason,extra")
    .eq("list_id", list.id)
    .order("rank", { ascending: true });
  if (entriesError) throw entriesError;
  const entries = (entriesData ?? []) as GameListEntry[];

  if (!entries.length) {
    return { list, entries: [] };
  }

  const universeIds = entries.map((entry) => entry.universe_id);
  const { data: universeData, error: universeError } = await sb
    .from("roblox_universes")
    .select(
      "universe_id,root_place_id,name,display_name,slug,icon_url,playing,visits,favorites,likes,dislikes,age_rating,desktop_enabled,mobile_enabled,tablet_enabled,console_enabled,vr_enabled,updated_at,description,game_description_md"
    )
    .in("universe_id", universeIds);
  if (universeError) throw universeError;
  const universeMap = new Map<number, ListUniverseDetails>(
    (universeData ?? []).map((row) => [row.universe_id, row as ListUniverseDetails])
  );

  const gameIds = entries.map((entry) => entry.game_id).filter((id): id is string => Boolean(id));
  let gameMap = new Map<string, GamePreview>();
  if (gameIds.length) {
    const gamesWithCounts = await listGamesWithActiveCountsForIds(gameIds);
    gameMap = new Map(gamesWithCounts.map((game) => [game.id, game]));
  }

  const combined = entries
    .map<GameListUniverseEntry | null>((entry) => {
      const universe = universeMap.get(entry.universe_id);
      if (!universe) {
        return null;
      }
      const game = entry.game_id ? gameMap.get(entry.game_id) ?? null : null;
      return {
        ...entry,
        universe,
        game
      };
    })
    .filter((value): value is GameListUniverseEntry => Boolean(value));

  return { list, entries: combined };
}

export async function listRanksForUniverses(
  universeIds: number[],
  excludeListId?: string
): Promise<Map<number, UniverseListBadge[]>> {
  if (!universeIds.length) {
    return new Map();
  }

  const sb = supabaseAdmin();
  const query = sb
    .from("game_list_entries")
    .select("universe_id, rank, list_id, game_lists!inner(id, slug, title, is_published)")
    .in("universe_id", universeIds);

  if (excludeListId) {
    query.neq("list_id", excludeListId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const map = new Map<number, UniverseListBadge[]>();
  for (const row of data ?? []) {
    const list = (row as any).game_lists;
    if (!list || !list.is_published) continue;
    if (row.rank > 3) continue;
    const badge: UniverseListBadge = {
      list_id: list.id,
      list_slug: list.slug,
      list_title: list.title,
      rank: row.rank
    };
    const existing = map.get(row.universe_id) ?? [];
    existing.push(badge);
    map.set(row.universe_id, existing);
  }

  for (const [key, badges] of map.entries()) {
    const filtered = badges.filter((badge) => badge.rank >= 1 && badge.rank <= 3).sort((a, b) => a.rank - b.rank);
    map.set(key, filtered.slice(0, 3));
  }

  return map;
}

export async function listPublishedArticles(limit = 20, offset = 0): Promise<ArticleWithRelations[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('articles')
    .select(articleSelectFields())
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ArticleWithRelations[];
}

export async function getArticleBySlug(slug: string): Promise<ArticleWithRelations | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('articles')
    .select(articleSelectFields())
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as unknown as ArticleWithRelations;
}

export async function listRecentArticlesForSitemap(): Promise<ArticleWithRelations[]> {
  return listPublishedArticles(200, 0);
}

export async function listPublishedGamesByAuthorWithActiveCounts(authorId: string): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data: games, error: gamesError } = await sb
    .from("games")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id")
    .eq("is_published", true)
    .eq("author_id", authorId)
    .order("name", { ascending: true });
  if (gamesError) throw gamesError;

  const gameList = (games ?? []) as GameSummaryFields[];
  if (!gameList.length) {
    return [];
  }

  const gameIds = gameList.map((g) => g.id);
  const { counts, latestFirstSeenMap } = await fetchActiveCodeStats(sb, gameIds);

  return gameList.map<GameWithCounts>((g) => {
    const latestFirstSeen = latestFirstSeenMap.get(g.id) ?? null;
    const updatedAtTime = Date.parse(g.updated_at ?? "");
    const latestFirstSeenTime = latestFirstSeen ? Date.parse(latestFirstSeen) : NaN;
    const hasLatestFirstSeen = Number.isFinite(latestFirstSeenTime);
    const hasUpdatedAt = Number.isFinite(updatedAtTime);
    let contentUpdatedAt: string | null = g.updated_at ?? null;
    if (hasLatestFirstSeen && hasUpdatedAt) {
      contentUpdatedAt = latestFirstSeenTime > updatedAtTime ? latestFirstSeen : g.updated_at ?? latestFirstSeen;
    } else if (hasLatestFirstSeen) {
      contentUpdatedAt = latestFirstSeen;
    }

    return {
      ...g,
      active_count: counts.get(g.id) || 0,
      latest_code_first_seen_at: latestFirstSeen,
      content_updated_at: contentUpdatedAt ?? g.updated_at ?? null
    };
  });
}

export async function getGameBySlug(slug: string): Promise<GameWithAuthor | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("*, author:authors(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (!data.author && DEFAULT_AUTHOR_ID) {
    const { data: fallback } = await sb
      .from("authors")
      .select("*")
      .eq("id", DEFAULT_AUTHOR_ID)
      .maybeSingle();
    if (fallback) {
      (data as any).author = fallback;
    }
  }

  return data as GameWithAuthor;
}

export async function getRobloxUniverseById(universeId: number): Promise<RobloxUniverseInfo | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("roblox_universes")
    .select("universe_id, name, display_name, creator_name, creator_id, creator_type, social_links")
    .eq("universe_id", universeId)
    .maybeSingle();

  if (error) throw error;
  return (data as RobloxUniverseInfo) || null;
}

export async function listCodesForGame(gameId: string): Promise<Code[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("codes")
    .select("*")
    .eq("game_id", gameId)
    .order("status", { ascending: true })  // active first if status sorted lexicographically by custom order handled in UI
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return data as Code[];
}
