import type { SupabaseClient } from "@supabase/supabase-js";
import { categorySlugFromGame } from "@/lib/slug";

type GameInfo = {
  id: string;
  slug: string;
  name: string;
};

function isNoRowError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST116";
}

async function fetchCategoryBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ id: string; slug: string; name: string; game_id: string | null } | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("article_categories")
    .select("id, slug, name, game_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error && !isNoRowError(error)) {
    throw error;
  }

  return (data as { id: string; slug: string; name: string; game_id: string | null } | null) ?? null;
}

export interface AdminCategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  article_count: number;
  game: {
    id: string | null;
    name: string | null;
    slug: string | null;
  };
}

export async function fetchAdminCategories(client: SupabaseClient): Promise<AdminCategorySummary[]> {
  const { data, error } = await client
    .from("article_categories")
    .select(
      `id, name, slug, description, created_at, updated_at,
       game:games ( id, name, slug )`
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const categories = (data ?? []).map((row) => {
    const gameField = row.game;
    const gameEntry = Array.isArray(gameField) ? gameField[0] : gameField;
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      description: (row.description as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      article_count: 0,
      game: {
        id: gameEntry?.id ?? null,
        name: gameEntry?.name ?? null,
        slug: gameEntry?.slug ?? null
      }
    } satisfies AdminCategorySummary;
  });

  const categoryIds = categories.map((category) => category.id);
  if (categoryIds.length === 0) {
    return categories;
  }

  const { data: articleRows, error: articleError } = await client
    .from("articles")
    .select("id, category_id")
    .in("category_id", categoryIds);

  if (articleError) throw articleError;

  const counts = new Map<string, number>();
  for (const row of articleRows ?? []) {
    if (!row?.category_id) continue;
    const key = row.category_id as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return categories.map((category) => ({
    ...category,
    article_count: counts.get(category.id) ?? 0
  }));
}

export async function ensureCategoryForGame(
  supabase: SupabaseClient,
  game: GameInfo
): Promise<{ slug: string | null; previousSlug: string | null }> {
  const desiredSlug = categorySlugFromGame(game);
  if (!desiredSlug) {
    return { slug: null, previousSlug: null };
  }

  const desiredExisting = await fetchCategoryBySlug(supabase, desiredSlug);
  let existing = desiredExisting;
  let previousSlug: string | null = null;

  if (!existing && game.slug) {
    const legacy = await fetchCategoryBySlug(supabase, game.slug);
    if (legacy) {
      existing = legacy;
    }
  }

  if (!existing) {
    const { data, error } = await supabase
      .from("article_categories")
      .insert({
        name: game.name,
        slug: desiredSlug,
        game_id: game.id
      })
      .select("slug")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        // Slug already taken; leave as-is but avoid blocking game save
        return { slug: desiredSlug, previousSlug: null };
      }
      throw error;
    }

    return { slug: (data?.slug as string | undefined) ?? desiredSlug, previousSlug: null };
  }

  const updates: Record<string, unknown> = {};

  if (existing.slug !== desiredSlug) {
    updates.slug = desiredSlug;
    previousSlug = existing.slug;
  }
  if (existing.name !== game.name) {
    updates.name = game.name;
  }
  if (existing.game_id !== game.id) {
    updates.game_id = game.id;
  }

  if (Object.keys(updates).length === 0) {
    return { slug: existing.slug, previousSlug: null };
  }

  const { data, error } = await supabase
    .from("article_categories")
    .update(updates)
    .eq("id", existing.id)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && "slug" in updates) {
      // Another category already has the desired slug. Roll back slug change but keep other updates.
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.slug;
      if (Object.keys(fallbackUpdates).length) {
        const { error: fallbackError } = await supabase
          .from("article_categories")
          .update(fallbackUpdates)
          .eq("id", existing.id);
        if (fallbackError && !isNoRowError(fallbackError)) {
          throw fallbackError;
        }
      }
      return { slug: existing.slug, previousSlug: null };
    }
    throw error;
  }

  return { slug: (data?.slug as string | undefined) ?? desiredSlug, previousSlug };
}
