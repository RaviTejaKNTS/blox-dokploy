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
  cta_label?: string | null;
  cta_url?: string | null;
  schema_ld_json?: unknown;
  thumb_url?: string | null;
  is_published: boolean;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const TOOL_SELECT_FIELDS =
  "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at";
const TOOL_INDEX_FIELDS = "id, code, title, seo_title, meta_description, intro_md, thumb_url, published_at, created_at, updated_at";

export async function getToolContent(code: string): Promise<ToolContent | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("tools")
    .select(TOOL_SELECT_FIELDS)
    .eq("code", code)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching tool content", error);
    return null;
  }

  return (data as ToolContent) ?? null;
}

export type ToolListEntry = Pick<
  ToolContent,
  "id" | "code" | "title" | "seo_title" | "meta_description" | "intro_md" | "thumb_url" | "published_at"
> & { created_at?: string; updated_at?: string };

const cachedListPublishedTools = unstable_cache(
  async () => {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("tools")
      .select(TOOL_INDEX_FIELDS)
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching tools index", error);
      return [];
    }

    return (data ?? []) as ToolListEntry[];
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
