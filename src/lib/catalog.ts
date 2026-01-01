import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";

export type CatalogFaqEntry = { q: string; a: string };

export type CatalogPageContent = {
  id?: string;
  code: string;
  title: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  how_it_works_md: string;
  description_json: Record<string, string>;
  faq_json: CatalogFaqEntry[];
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

const CATALOG_SELECT_FIELDS_VIEW =
  "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at, content_updated_at";
const CATALOG_SELECT_FIELDS_BASE =
  "id, code, title, seo_title, meta_description, intro_md, how_it_works_md, description_json, faq_json, cta_label, cta_url, schema_ld_json, thumb_url, is_published, published_at, created_at, updated_at";

function pickFirstByCodeOrder<T extends { code: string }>(rows: T[], codes: string[]): T | null {
  for (const code of codes) {
    const match = rows.find((row) => row.code === code);
    if (match) return match;
  }
  return rows[0] ?? null;
}

async function fetchCatalogContent(codes: string[]): Promise<CatalogPageContent | null> {
  if (!codes.length) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("catalog_pages_view")
    .select(CATALOG_SELECT_FIELDS_VIEW)
    .in("code", codes)
    .eq("is_published", true);

  if (!error && data?.length) {
    return pickFirstByCodeOrder(data as CatalogPageContent[], codes);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("catalog_pages")
    .select(CATALOG_SELECT_FIELDS_BASE)
    .in("code", codes)
    .eq("is_published", true);

  if (fallbackError) {
    console.error("Error fetching catalog page content", fallbackError);
    return null;
  }

  if (!fallback?.length) return null;
  return pickFirstByCodeOrder(fallback as CatalogPageContent[], codes);
}

const cachedCatalogContent = unstable_cache(
  async (codes: string[]) => fetchCatalogContent(codes),
  ["catalog-page-content"],
  {
    revalidate: 2592000,
    tags: ["catalog-index"]
  }
);

export async function getCatalogPageContentByCodes(codes: string[]): Promise<CatalogPageContent | null> {
  return cachedCatalogContent(codes);
}
