import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminGameCode {
  id: string;
  code: string;
  status: "active" | "check" | "expired";
  rewards_text: string | null;
  level_requirement: number | null;
  is_new: boolean | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AdminGameSummary {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
  updated_at: string;
  created_at: string;
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
  intro_md: string | null;
  redeem_md: string | null;
  description_md: string | null;
  seo_title: string | null;
  seo_description: string | null;
  cover_image: string | null;
  expired_codes: string[];
  author: { id: string | null; name: string | null };
  counts: { active: number; check: number; expired: number };
  codes: {
    active: AdminGameCode[];
    check: AdminGameCode[];
    expired: string[];
  };
}

export type AdminAuthorOption = {
  id: string;
  name: string;
};

export async function fetchAdminGames(client: SupabaseClient): Promise<AdminGameSummary[]> {
  const { data: games, error } = await client
    .from("games")
    .select(
      `id, name, slug, is_published, created_at, updated_at, source_url, source_url_2, source_url_3,
       intro_md, redeem_md, description_md, seo_title, seo_description, cover_image, expired_codes,
       author:authors ( id, name )`
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const gameIds = (games ?? []).map((game) => game.id);
  if (gameIds.length === 0) {
    return [];
  }

  const { data: codeRows, error: codeError } = await client
    .from("codes")
    .select("id, game_id, code, status, rewards_text, level_requirement, is_new, first_seen_at, last_seen_at")
    .in("game_id", gameIds);

  if (codeError) throw codeError;

  const counts = new Map<string, { active: number; check: number; expired: number }>();
  const groupedCodes = new Map<string, { active: AdminGameCode[]; check: AdminGameCode[] }>();

  for (const row of codeRows ?? []) {
    const entry = groupedCodes.get(row.game_id) || { active: [], check: [] };
    const codeInfo: AdminGameCode = {
      id: row.id,
      code: row.code,
      status: row.status as AdminGameCode["status"],
      rewards_text: row.rewards_text,
      level_requirement: row.level_requirement,
      is_new: row.is_new,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at
    };

    if (row.status === "active") {
      entry.active.push(codeInfo);
    } else if (row.status === "check") {
      entry.check.push(codeInfo);
    }
    groupedCodes.set(row.game_id, entry);

    const countRef = counts.get(row.game_id) || { active: 0, check: 0, expired: 0 };
    if (row.status === "active") {
      countRef.active += 1;
    } else if (row.status === "check") {
      countRef.check += 1;
    } else if (row.status === "expired") {
      countRef.expired += 1;
    }
    counts.set(row.game_id, countRef);
  }

  return (games ?? []).map((game) => {
    const grouped = groupedCodes.get(game.id) ?? { active: [], check: [] };
    const count = counts.get(game.id) ?? { active: 0, check: 0, expired: game.expired_codes?.length ?? 0 };

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      is_published: game.is_published,
      created_at: game.created_at,
      updated_at: game.updated_at,
      source_url: game.source_url,
      source_url_2: game.source_url_2,
      source_url_3: game.source_url_3,
      intro_md: game.intro_md,
      redeem_md: game.redeem_md,
      description_md: game.description_md,
      seo_title: game.seo_title,
      seo_description: game.seo_description,
      cover_image: game.cover_image,
      expired_codes: Array.isArray(game.expired_codes) ? game.expired_codes : [],
      author: (() => {
        const authorEntry = Array.isArray(game.author) ? game.author[0] : game.author;
        return {
          id: authorEntry?.id ?? null,
          name: authorEntry?.name ?? null
        };
      })(),
      counts: {
        active: count.active,
        check: count.check,
        expired: count.expired + (Array.isArray(game.expired_codes) ? game.expired_codes.length : 0)
      },
      codes: {
        active: grouped.active,
        check: grouped.check,
        expired: Array.isArray(game.expired_codes) ? game.expired_codes : []
      }
    };
  });
}

export async function fetchAdminAuthors(client: SupabaseClient): Promise<AdminAuthorOption[]> {
  const { data, error } = await client
    .from("authors")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((author) => ({ id: author.id, name: author.name }));
}
