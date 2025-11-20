import { notFound, permanentRedirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

type PageProps = {
  params: { slug?: string };
};

export default async function LegacySlugPage({ params }: PageProps) {
  const normalizedSlug = params.slug?.trim().toLowerCase() ?? "";
  if (!normalizedSlug) {
    notFound();
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("slug")
    .contains("old_slugs", [normalizedSlug])
    .maybeSingle();

  if (error) throw error;
  if (!data?.slug || data.slug === normalizedSlug) {
    notFound();
  }

  permanentRedirect(`/codes/${data.slug}`);
}
