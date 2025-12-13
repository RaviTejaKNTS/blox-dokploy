import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export type ToolFaqEntry = { q: string; a: string };

export type ToolContent = {
  id?: string;
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: ToolFaqEntry[];
  universe_id?: number | null;
  cta_label?: string | null;
  cta_url?: string | null;
  schema_ld_json?: unknown;
  thumb_url?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  content_updated_at?: string | null;
};

const TOOL_SELECT_FIELDS =
  "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, universe_id, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at, content_updated_at";
const TOOL_INDEX_FIELDS_VIEW =
  "id, code, title, seo_title, meta_description, intro_md, thumb_url, universe_id, published_at, created_at, updated_at, content_updated_at";
const TOOL_INDEX_FIELDS_BASE =
  "id, code, title, seo_title, meta_description, intro_md, thumb_url, universe_id, published_at, created_at, updated_at";

export async function getToolContent(code: string): Promise<ToolContent | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("tools_view")
    .select(TOOL_SELECT_FIELDS)
    .eq("code", code)
    .eq("is_published", true)
    .maybeSingle();

  if (!error && data) {
    return data as ToolContent;
  }

  // Fallback to the base table with a safe field set (no content_updated_at)
  const { data: fallback, error: fallbackError } = await supabase
    .from("tools")
    .select(
      "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at"
    )
    .eq("code", code)
    .eq("is_published", true)
    .maybeSingle();

  if (fallbackError) {
    console.error("Error fetching tool content", fallbackError);
    return null;
  }

  return (fallback as ToolContent) ?? null;
}

export type ToolListEntry = Pick<
  ToolContent,
  "id" | "code" | "title" | "seo_title" | "meta_description" | "intro_md" | "thumb_url" | "published_at" | "universe_id"
> & { created_at?: string; updated_at?: string; content_updated_at?: string | null };

const cachedListPublishedTools = unstable_cache(
  async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("tools_view")
      .select(TOOL_INDEX_FIELDS_VIEW)
      .eq("is_published", true)
      .order("content_updated_at", { ascending: false });

    if (!error && data) {
      return (data ?? []) as ToolListEntry[];
    }

    const { data: fallback, error: fallbackError } = await supabase
      .from("tools")
      .select(TOOL_INDEX_FIELDS_BASE)
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    if (fallbackError) {
      console.error("Error fetching tools index", fallbackError);
      return [];
    }

    return (fallback ?? []) as ToolListEntry[];
  },
  ["listPublishedTools"],
  {
    revalidate: 21600, // 6 hours
    tags: ["tools-index"]
  }
);

export async function listPublishedTools(): Promise<ToolListEntry[]> {
  return cachedListPublishedTools();
}

export async function listPublishedToolsPage(
  page: number,
  pageSize: number
): Promise<{ tools: ToolListEntry[]; total: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  const cached = unstable_cache(
    async () => {
      const supabase = supabaseAdmin();
      const { data, error, count } = await supabase
        .from("tools_view")
        .select(TOOL_INDEX_FIELDS_VIEW, { count: "exact" })
        .eq("is_published", true)
        .order("content_updated_at", { ascending: false })
        .range(offset, offset + safePageSize - 1);

      if (!error && data) {
        return { tools: (data ?? []) as ToolListEntry[], total: count ?? data.length };
      }

      const { data: fallback, error: fallbackError, count: fallbackCount } = await supabase
        .from("tools")
        .select(TOOL_INDEX_FIELDS_BASE, { count: "exact" })
        .eq("is_published", true)
        .order("updated_at", { ascending: false })
        .range(offset, offset + safePageSize - 1);

      if (fallbackError) {
        console.error("Error fetching tools index", fallbackError);
        return { tools: [], total: 0 };
      }

      return { tools: (fallback ?? []) as ToolListEntry[], total: fallbackCount ?? (fallback ?? []).length };
    },
    [`listPublishedToolsPage:${safePage}:${safePageSize}`],
    {
      revalidate: 21600,
      tags: ["tools-index"]
    }
  );

  return cached();
}

export async function listPublishedToolsByUniverseId(
  universeId: number,
  limit = 3
): Promise<ToolListEntry[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("tools_view")
    .select(TOOL_INDEX_FIELDS_VIEW)
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("content_updated_at", { ascending: false })
    .limit(limit);

  if (!error && data) {
    return (data ?? []) as ToolListEntry[];
  }

  const { data: fallback } = await supabase
    .from("tools")
    .select(TOOL_INDEX_FIELDS_BASE)
    .eq("is_published", true)
    .eq("universe_id", universeId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (fallback ?? []) as ToolListEntry[];
}
