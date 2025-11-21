import { permanentRedirect, notFound } from "next/navigation";
import legacySlugs from "@/data/slug_oldslugs.json";

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

type LegacySlugEntry = {
  slug: string;
  old_slugs: string[];
};

const LEGACY_SLUG_MAP = new Map<string, string>(
  (legacySlugs as LegacySlugEntry[]).flatMap(({ slug, old_slugs }) => {
    const canonical = slug.trim().toLowerCase();
    return old_slugs
      .map((oldSlug) => oldSlug?.trim().toLowerCase())
      .filter((oldSlug): oldSlug is string => Boolean(oldSlug) && oldSlug !== canonical)
      .map((oldSlug) => [oldSlug, slug]);
  })
);

function resolveLegacySlug(slug?: string) {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized) return null;
  return LEGACY_SLUG_MAP.get(normalized) ?? null;
}

export default async function LegacySlugPage({ params }: PageProps) {
  const normalized = params.slug?.trim().toLowerCase();
  if (normalized && ARTICLE_REDIRECT_SLUGS.has(normalized)) {
    permanentRedirect(`/articles/${normalized}`);
  }

  const canonicalSlug = resolveLegacySlug(params.slug);
  if (!canonicalSlug) {
    notFound();
  }

  permanentRedirect(`/codes/${canonicalSlug}`);
}
