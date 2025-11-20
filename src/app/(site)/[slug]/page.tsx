import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

type PageProps = {
  params: { slug?: string };
};

async function resolveLegacySlug(slug?: string) {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) return null;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("slug")
    .contains("old_slugs", [normalized])
    .maybeSingle();

  if (error) throw error;
  if (!data?.slug || data.slug === normalized) return null;
  return data.slug;
}

export default async function LegacySlugPage({ params }: PageProps) {
  const canonicalSlug = await resolveLegacySlug(params.slug);
  if (!canonicalSlug) {
    notFound();
  }

  redirect(`/codes/${canonicalSlug}`);
}
