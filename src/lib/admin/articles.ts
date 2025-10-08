import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminArticleSummary {
  id: string;
  title: string;
  slug: string;
  content_md: string;
  cover_image: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  word_count: number | null;
  meta_description: string | null;
  author: { id: string | null; name: string | null };
  category: { id: string | null; name: string | null };
}

export interface AdminArticleCategoryOption {
  id: string;
  name: string;
}

function normalizeRelation<T extends { id: string; name: string } | null | undefined>(relation: T | T[]): {
  id: string | null;
  name: string | null;
} {
  if (Array.isArray(relation)) {
    const [entry] = relation;
    return {
      id: entry?.id ?? null,
      name: entry?.name ?? null
    };
  }
  if (!relation) {
    return { id: null, name: null };
  }
  return {
    id: relation.id ?? null,
    name: relation.name ?? null
  };
}

export async function fetchAdminArticles(client: SupabaseClient): Promise<AdminArticleSummary[]> {
  const { data, error } = await client
    .from("articles")
    .select(
      `id, title, slug, content_md, cover_image, is_published, published_at, created_at, updated_at,
       word_count, meta_description,
       author:authors ( id, name ),
       category:article_categories ( id, name )`
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, any>>;

  return rows.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    content_md: article.content_md ?? "",
    cover_image: article.cover_image ?? null,
    is_published: Boolean(article.is_published),
    published_at: article.published_at ?? null,
    created_at: article.created_at,
    updated_at: article.updated_at,
    word_count: article.word_count ?? null,
    meta_description: article.meta_description ?? null,
    author: normalizeRelation(article.author as { id: string; name: string } | null | undefined),
    category: normalizeRelation(article.category as { id: string; name: string } | null | undefined)
  }));
}

export async function fetchAdminArticleCategories(client: SupabaseClient): Promise<AdminArticleCategoryOption[]> {
  const { data, error } = await client
    .from("article_categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name
  }));
}
