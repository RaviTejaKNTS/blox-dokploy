import { unstable_cache } from "next/cache";
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
  interlinking_ai_copy_md: string | null;
  is_published: boolean;
  published_at: string | null;
  re_rewritten_at?: string | null;
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
  tags: string[];
};

export type UniverseSummary = {
  universe_id: number;
  slug: string | null;
  display_name: string | null;
  name: string | null;
  icon_url?: string | null;
  genre_l1?: string | null;
  genre_l2?: string | null;
};

export type ArticleWithRelations = Article & {
  author: Author | null;
  universe: UniverseSummary | null;
};

const ARTICLE_INDEX_FIELDS =
  `id,title,slug,cover_image,meta_description,published_at,created_at,updated_at,is_published,` +
  `author,universe`;

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
  display_name: string | null;
  primary_metric_key?: string | null;
  primary_metric_label?: string | null;
  cover_image: string | null;
  list_type: "sql" | "manual" | "hybrid";
  filter_config: Record<string, unknown> | null;
  limit_count: number;
  is_published: boolean;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
  top_entry_image?: string | null;
  entries?: unknown[] | null;
};

export type GameListEntry = {
  list_id: string;
  universe_id: number;
  game_id: string | null;
  rank: number;
  metric_value: number | null;
  metric_key?: string | null;
  metric_label?: string | null;
  reason: string | null;
  extra: Record<string, unknown> | null;
};

type GamePreview = Pick<Game, "id" | "slug" | "name" | "universe_id"> & {
  active_count?: number | null;
};

export type GameListUniverseEntry = GameListEntry & {
  universe: ListUniverseDetails;
  game: GamePreview | null;
  badges?: UniverseListBadge[] | null;
};

export type UniverseListBadge = {
  list_id: string;
  list_slug: string;
  list_title: string;
  rank: number;
};

export type ChecklistPage = {
  id: string;
  universe_id: number;
  slug: string;
  title: string;
  description_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  content_updated_at?: string | null;
  universe?: UniverseSummary | null;
};

export type ChecklistItem = {
  id: string;
  page_id: string;
  section_code: string;
  title: string;
  description: string | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
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
  genre_l1?: string | null;
  genre_l2?: string | null;
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

type CodePageSummary = GameSummaryFields & {
  active_code_count?: number | null;
  latest_code_first_seen_at?: string | null;
  content_updated_at?: string | null;
  genre_l1?: string | null;
  genre_l2?: string | null;
  universe?: { genre_l1?: string | null; genre_l2?: string | null } | null;
};

function mapCodePageRowToCounts(row: CodePageSummary): GameWithCounts {
  return {
    ...row,
    active_count: row.active_code_count ?? 0,
    latest_code_first_seen_at: row.latest_code_first_seen_at ?? null,
    content_updated_at: row.content_updated_at ?? row.updated_at ?? null,
    genre_l1: row.genre_l1 ?? row.universe?.genre_l1 ?? null,
    genre_l2: row.genre_l2 ?? row.universe?.genre_l2 ?? null
  };
}

async function fetchGamesWithActiveCounts(): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_pages_index_view")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
    .eq("is_published", true)
    .order("content_updated_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
}

const cachedListGamesWithActiveCounts = unstable_cache(
  fetchGamesWithActiveCounts,
  ["listGamesWithActiveCounts"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index", "home"]
  }
);

export async function listGamesWithActiveCounts(): Promise<GameWithCounts[]> {
  return cachedListGamesWithActiveCounts();
}

export async function listGamesWithActiveCountsForIds(gameIds: string[]): Promise<GameWithCounts[]> {
  if (!gameIds.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(gameIds));
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_pages_index_view")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
    .eq("is_published", true)
    .in("id", uniqueIds);
  if (error) throw error;

  const gameList = (data ?? []) as CodePageSummary[];
  if (!gameList.length) {
    return [];
  }

  const withCounts = gameList.map((row) => mapCodePageRowToCounts(row));
  const map = new Map(withCounts.map((game) => [game.id, game]));

  return gameIds.map((id) => map.get(id)).filter((game): game is GameWithCounts => Boolean(game));
}

export async function listGamesWithActiveCountsByUniverseId(universeId: number, limit = 1): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("code_pages_view")
    .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("content_updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
}

export async function listPublishedGameLists(): Promise<GameList[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_lists_index_view")
    .select("id, slug, title, display_name, cover_image, limit_count, refreshed_at, updated_at, created_at, top_entry_image")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GameList[];
}

export async function getGameListMetadata(slug: string): Promise<GameList | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("game_lists_view")
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
  const { data, error } = await sb
    .from("game_lists_view")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const list = data as GameList & { entries?: unknown[] };
  const entriesRaw = Array.isArray(list.entries) ? list.entries : [];
  const entries = entriesRaw
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const universe = (record.universe ?? null) as ListUniverseDetails | null;
      const game = (record.game ?? null) as GamePreview | null;
      const badges = Array.isArray((record as any).badges) ? ((record as any).badges as UniverseListBadge[]) : null;
      const metricKey =
        (record as { metric_key?: unknown }).metric_key ??
        ((record as { extra?: Record<string, unknown> | null }).extra?.metric as unknown);
      const metricLabel =
        (record as { metric_label?: unknown }).metric_label ??
        ((record as { extra?: Record<string, unknown> | null }).extra?.metric_label as unknown);
      if (!universe) return null;
      return {
        list_id: (record.list_id as string) ?? list.id,
        universe_id: record.universe_id as number,
        game_id: (record.game_id as string | null) ?? null,
        rank: (record.rank as number) ?? 0,
        metric_value: (record.metric_value as number | null) ?? null,
        metric_key: (typeof metricKey === "string" ? metricKey : null),
        metric_label: (typeof metricLabel === "string" ? metricLabel : null),
        reason: (record.reason as string | null) ?? null,
        extra: (record.extra as Record<string, unknown> | null) ?? null,
        universe,
        game,
        badges: badges && badges.length ? badges : undefined
      } as GameListUniverseEntry;
    })
    .filter((entry): entry is GameListUniverseEntry => Boolean(entry));

  // If the view did not include active counts, hydrate them in a single fetch
  const missingGameIds = entries
    .map((entry) => entry.game?.id)
    .filter((id): id is string => Boolean(id))
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter((id) => {
      const game = entries.find((e) => e.game?.id === id)?.game;
      return game && (game.active_count === null || game.active_count === undefined);
    });

  if (missingGameIds.length) {
    const withCounts = await listGamesWithActiveCountsForIds(missingGameIds);
    const map = new Map(withCounts.map((g) => [g.id, g]));
    for (const entry of entries) {
      const gid = entry.game?.id;
      if (gid && map.has(gid)) {
        entry.game = { ...entry.game, ...map.get(gid)! };
      }
    }
  }

  // If badges are missing, hydrate them in one query
  const missingBadgeUniverseIds = entries
    .filter((entry) => !entry.badges || entry.badges.length === 0)
    .map((entry) => entry.universe_id)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  if (missingBadgeUniverseIds.length) {
    const badgeMap = await listRanksForUniverses(missingBadgeUniverseIds, list.id);
    for (const entry of entries) {
      if (!entry.badges || entry.badges.length === 0) {
        entry.badges = badgeMap.get(entry.universe_id) ?? undefined;
      }
    }
  }

  return { list, entries };
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

const cachedListPublishedArticles = unstable_cache(
  async (limit: number, offset: number) => {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('article_pages_index_view')
      .select(ARTICLE_INDEX_FIELDS)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const mapped = rows.map((row) => ({
      ...row,
      content_md: "",
      tags: [],
      word_count: null,
      author: (row as any).author ?? null,
      universe: (row as any).universe ?? null
    })) as unknown as ArticleWithRelations[];
    return mapped;
  },
  ["listPublishedArticles"],
  {
    revalidate: 21600, // 6 hours
    tags: ["articles-index", "home"]
  }
);

export async function listPublishedArticles(limit = 20, offset = 0): Promise<ArticleWithRelations[]> {
  return cachedListPublishedArticles(limit, offset);
}

export async function listPublishedArticlesByUniverseId(
  universeId: number,
  limit = 3,
  offset = 0
): Promise<ArticleWithRelations[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("article_pages_index_view")
    .select(ARTICLE_INDEX_FIELDS)
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const mapped = rows.map((row) => ({
    ...row,
    content_md: "",
    tags: [],
    word_count: null,
    author: (row as any).author ?? null,
    universe: (row as any).universe ?? null
  })) as unknown as ArticleWithRelations[];
  return mapped;
}

export async function getArticleBySlug(slug: string): Promise<ArticleWithRelations | null> {
  const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('article_pages_view')
      .select(
        `*, author:authors(id,name,slug,avatar_url,gravatar_email,bio_md,twitter,youtube,website,facebook,linkedin,instagram,roblox,discord,created_at,updated_at), universe:roblox_universes(universe_id,slug,display_name,name,icon_url,genre_l1,genre_l2)`
      )
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

export async function listPublishedGamesByAuthorWithActiveCounts(
  authorId: string,
  authorSlug?: string | null
): Promise<GameWithCounts[]> {
  const tagSlug = authorSlug?.trim().toLowerCase() ?? null;
  const cached = unstable_cache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("game_pages_index_view")
        .select("id,name,slug,cover_image,created_at,updated_at,universe_id,genre_l1,genre_l2,active_code_count,latest_code_first_seen_at,content_updated_at")
        .eq("is_published", true)
        .eq("author_id", authorId)
        .order("name", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row) => mapCodePageRowToCounts(row as CodePageSummary));
    },
    [`listPublishedGamesByAuthorWithActiveCounts:${authorId}`],
    {
      revalidate: 21600, // 6 hours
      tags: ["authors-index", tagSlug ? `author:${tagSlug}` : null].filter(Boolean) as string[]
    }
  );

  return cached();
}

const cachedGetChecklistPageBySlug = unstable_cache(
  async (slug: string) => {
    const normalizedSlug = slug.trim().toLowerCase();
    const sb = supabaseAdmin();

    let page: ChecklistPage | null = null;

    // Prefer the view; fall back to the base table if needed
    const { data: viewPage, error: viewError } = await sb
      .from("checklist_pages_view")
      .select("*")
      .eq("slug", normalizedSlug)
      .eq("is_public", true)
      .maybeSingle();

    if (!viewError && viewPage) {
      page = viewPage as ChecklistPage;
    } else {
      const { data: tablePage, error: tableError } = await sb
        .from("checklist_pages")
        .select("*")
        .eq("slug", normalizedSlug)
        .eq("is_public", true)
        .maybeSingle();
      if (tableError) throw tableError;
      page = (tablePage as ChecklistPage) ?? null;
    }

    if (!page) return null;

    const { data: items, error: itemsError } = await sb
      .from("checklist_items")
      .select("*")
      .eq("page_id", (page as any).id)
      .order("section_code", { ascending: true });

    if (itemsError) throw itemsError;

    return {
      page,
      items: (items ?? []) as ChecklistItem[]
    };
  },
  ["getChecklistPageBySlug"],
  {
    revalidate: 1800,
    tags: ["checklists-index"]
  }
);

export async function getChecklistPageBySlug(
  slug: string
): Promise<{ page: ChecklistPage; items: ChecklistItem[] } | null> {
  return cachedGetChecklistPageBySlug(slug.trim().toLowerCase());
}

export async function listPublishedChecklistSlugs(): Promise<string[]> {
  const cached = unstable_cache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("checklist_pages")
        .select("slug")
        .eq("is_public", true);
      if (error) throw error;
      return (data ?? []).map((row) => (row as { slug: string }).slug);
    },
    ["listPublishedChecklistSlugs"],
    {
      revalidate: 1800,
      tags: ["checklists-index"]
    }
  );

  return cached();
}

type ChecklistSummaryRow = {
  id: string;
  slug: string;
  title: string;
  description_md?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  content_updated_at?: string | null;
  universe_id?: number | null;
  item_count?: number;
  leaf_item_count?: number;
  universe?: {
    display_name?: string | null;
    name?: string | null;
    icon_url?: string | null;
    thumbnail_urls?: unknown;
  } | null;
  items?: Array<{ count?: number }>;
};

export async function listPublishedChecklists(): Promise<ChecklistSummaryRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("checklist_pages_view")
    .select("id, slug, title, description_md, seo_description, published_at, updated_at, created_at, content_updated_at, item_count, leaf_item_count, universe, universe_id")
    .eq("is_public", true)
    .order("content_updated_at", { ascending: false });

  if (!error && data) {
    return (data ?? []) as ChecklistSummaryRow[];
  }

  // Fallback to base table if the view is unavailable
  const { data: fallback, error: fallbackError } = await sb
    .from("checklist_pages")
    .select(
      `
        id,
        slug,
        title,
        description_md,
        seo_description,
        published_at,
        updated_at,
        created_at,
        universe:roblox_universes(display_name, name, icon_url, thumbnail_urls)
      `
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (fallbackError) throw fallbackError;

  return (fallback ?? []) as ChecklistSummaryRow[];
}

export async function listPublishedChecklistsByUniverseId(universeId: number, limit = 1): Promise<ChecklistSummaryRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("checklist_pages_view")
    .select("id, slug, title, description_md, seo_description, published_at, updated_at, created_at, content_updated_at, item_count, leaf_item_count, universe, universe_id")
    .eq("is_public", true)
    .eq("universe_id", universeId)
    .order("content_updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ChecklistSummaryRow[];
}

export async function getGameBySlug(slug: string): Promise<GameWithAuthor | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const cached = unstable_cache(
    async () => {
      const sb = supabaseAdmin();
      const { data, error } = await sb
        .from("code_pages_view")
        .select("*")
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      if (!(data as any).author && DEFAULT_AUTHOR_ID) {
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
    },
    [`getGameBySlug:${normalizedSlug}`],
    {
      revalidate: 21600, // 6 hours
      tags: ["codes-index", `code:${normalizedSlug}`]
    }
  );

  return cached();
}

const cachedGetRobloxUniverseById = unstable_cache(
  async (universeId: number) => {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, name, display_name, creator_name, creator_id, creator_type, social_links")
      .eq("universe_id", universeId)
      .maybeSingle();

    if (error) throw error;
    return (data as RobloxUniverseInfo) || null;
  },
  ["getRobloxUniverseById"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index"]
  }
);

export async function getRobloxUniverseById(universeId: number): Promise<RobloxUniverseInfo | null> {
  return cachedGetRobloxUniverseById(universeId);
}

const cachedListCodesForGame = unstable_cache(
  async (gameId: string) => {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("code_pages_view")
      .select("codes")
      .eq("id", gameId)
      .maybeSingle();
    if (error) throw error;
    const codes = (data as { codes?: unknown })?.codes;
    if (!Array.isArray(codes)) return [];
    return codes as Code[];
  },
  ["listCodesForGame"],
  {
    revalidate: 21600, // 6 hours
    tags: ["codes-index"]
  }
);

export async function listCodesForGame(gameId: string): Promise<Code[]> {
  return cachedListCodesForGame(gameId);
}
