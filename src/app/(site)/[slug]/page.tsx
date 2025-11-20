import { permanentRedirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

type PageProps = {
  params: { slug?: string };
};

const ARTICLE_REDIRECT_SLUGS = new Set([
  "when-does-the-museum-open-in-jailbreak-roblox",
  "how-to-level-up-fast-in-jailbreak-criminal-vs-cop",
  "how-to-get-a-mansion-invite-in-jailbreak-roblox",
  "steal-a-brainrot-dealer-update-guide",
  "why-roblox-s-simple-graphics-still-beat-every-realistic-game",
  "where-to-find-criminal-base-on-roblox-jailbreak",
  "how-to-get-robux-free-and-paid",
  "best-simple-roblox-games-for-beginners",
  "how-to-get-spooky-chest-in-grow-a-garden",
  "roblox-halloween-spotlight-event-2025",
  "create-and-publish-roblox-game",
  "all-fisch-enchantments-guide"
]);

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
  const normalized = params.slug?.trim().toLowerCase();
  if (normalized && ARTICLE_REDIRECT_SLUGS.has(normalized)) {
    permanentRedirect(`/articles/${normalized}`);
  }

  const canonicalSlug = await resolveLegacySlug(params.slug);
  if (!canonicalSlug) {
    notFound();
  }

  permanentRedirect(`/codes/${canonicalSlug}`);
}
