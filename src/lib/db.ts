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
  expired_codes: string[] | null;
  cover_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  intro_md: string | null;
  redeem_md: string | null;
  description_md: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type GameWithAuthor = Game & { author: Author | null };

export type Code = {
  id: string;
  game_id: string;
  code: string;
  status: "active"|"expired"|"check";
  rewards_text: string | null;
  level_requirement: number | null;
  is_new: boolean | null;
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

export type GameWithCounts = Game & {
  active_count: number;
  latest_code_first_seen_at: string | null;
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

export async function listGamesWithActiveCounts(): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data: games, error: gamesError } = await sb
    .from("games")
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (gamesError) throw gamesError;

  const gameList = (games ?? []) as Game[];
  if (gameList.length === 0) {
    return [];
  }
  const gameIds = gameList.map((g) => g.id);

  const { data: activeCodes, error: codesError } = await sb
    .from("codes")
    .select("game_id")
    .eq("status", "active")
    .in("game_id", gameIds);
  if (codesError) throw codesError;

  const counts = new Map<string, number>();
  for (const row of activeCodes || []) {
    counts.set(row.game_id, (counts.get(row.game_id) || 0) + 1);
  }

  const { data: latestCodeRows, error: latestCodeError } = await sb
    .from("codes")
    .select("game_id,max:first_seen_at", { group: "game_id" })
    .in("game_id", gameIds);
  if (latestCodeError) throw latestCodeError;

  const latestFirstSeenMap = new Map<string, string | null>();
  for (const row of latestCodeRows || []) {
    const record = row as unknown as { game_id: string; max: string | null };
    latestFirstSeenMap.set(record.game_id, record.max ?? null);
  }

  const toTimestamp = (value: string | null | undefined): number => {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  return gameList
    .map((g) => {
      const latestFirstSeen = latestFirstSeenMap.get(g.id) ?? null;
      return {
        ...g,
        active_count: counts.get(g.id) || 0,
        latest_code_first_seen_at: latestFirstSeen,
      } satisfies GameWithCounts;
    })
    .sort((a, b) => {
      const aTime = toTimestamp(a.latest_code_first_seen_at ?? a.updated_at);
      const bTime = toTimestamp(b.latest_code_first_seen_at ?? b.updated_at);
      return bTime - aTime;
    });
}

export async function listPublishedGamesByAuthorWithActiveCounts(authorId: string): Promise<GameWithCounts[]> {
  const sb = supabaseAdmin();
  const { data: games, error: gamesError } = await sb
    .from("games")
    .select("*")
    .eq("is_published", true)
    .eq("author_id", authorId)
    .order("name", { ascending: true });
  if (gamesError) throw gamesError;

  if (!games || games.length === 0) {
    return [];
  }

  const gameIds = games.map((g) => g.id);
  const { data: activeCodes, error: codesError } = await sb
    .from("codes")
    .select("game_id")
    .eq("status", "active")
    .in("game_id", gameIds);
  if (codesError) throw codesError;

  const counts = new Map<string, number>();
  for (const row of activeCodes || []) {
    counts.set(row.game_id, (counts.get(row.game_id) || 0) + 1);
  }

  const { data: latestCodeRows, error: latestCodeError } = await sb
    .from("codes")
    .select("game_id,max:first_seen_at", { group: "game_id" })
    .in("game_id", gameIds);
  if (latestCodeError) throw latestCodeError;

  const latestFirstSeenMap = new Map<string, string | null>();
  for (const row of latestCodeRows || []) {
    const record = row as unknown as { game_id: string; max: string | null };
    latestFirstSeenMap.set(record.game_id, record.max ?? null);
  }

  return games.map((g) => ({
    ...(g as Game),
    active_count: counts.get(g.id) || 0,
    latest_code_first_seen_at: latestFirstSeenMap.get(g.id) ?? null
  })) as GameWithCounts[];
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
