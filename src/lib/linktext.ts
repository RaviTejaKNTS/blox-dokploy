import type { SupabaseClient } from "@supabase/supabase-js";

export type LinktextOptions = {
  slugs?: string[];
  overwrite?: boolean;
  dryRun?: boolean;
  limit?: number;
  minLinks?: number;
  logger?: (message: string) => void;
};

export type LinktextResult = {
  updated: number;
  skippedExisting: number;
  skippedMissingRecommendations: number;
  errors: number;
};

type GameRow = {
  id: string;
  name: string;
  slug: string;
  genre: string | null;
  sub_genre: string | null;
  linktext_md: string | null;
  internal_links: number | null;
  is_published: boolean;
};

const DEFAULT_MIN_LINKS = 3;

const OPENERS = [
  "While you're waiting for the next batch of freebies",
  "Between code drops",
  "If the latest rewards aren't enough",
  "Need something else to grind",
  "Want more codes to redeem right now",
  "Still sitting on extra boost time and wondering what to do next",
  "Let me point you toward a few more worlds while the devs cook up new gifts",
  "If your luck ran dry for the moment, don't worry—I've got more hunts lined up",
  "Got a squad ready to play but this game is on cooldown",
  "Looking for something familiar yet fresh to keep your combo going",
  "If you enjoy theory-crafting builds, these other lobbies scratch the same itch",
  "Need a palate cleanser before you come back for the next raid",
  "If you're helping friends climb leaderboards, these picks keep everyone busy",
  "Want to test strategies on other bosses before returning here",
  "Feeling the grind wall creeping in",
  "Still browsing for that next hidden code",
  "If your daily streak is safely banked and you want more variety",
  "You cleared the latest questline already, so let's tee up the next trip",
  "If you're chasing the meta across multiple games, here are a few more stops",
  "In case you just opened Roblox and need a short list of what to play next"
];

const GENRE_PROMPTS = [
  "check out other {genre} experiences like {list}",
  "queue up {list} for more {genre} action",
  "dive into {list} to keep the {genre} grind going",
  "farm extra rewards in {list}",
  "hop into {list} for fresh {genre} challenges",
  "line up {list} if you want a slightly different flavor of {genre} chaos",
  "bookmark {list} so you always have backup {genre} grinds during downtime",
  "compare your favorite builds inside {list} and see which {genre} meta you prefer",
  "share some of your best farming routes with friends over in {list}",
  "tackle {list} when you feel like testing your squad's chemistry in another {genre} arena",
  "stack more gacha pulls by hopping into {list}",
  "keep your reflexes warm by rotating through {list}",
  "queue ranked lobbies inside {list} whenever matchmaking slows down here",
  "practice boss-mechanics in {list} before new patches drop",
  "collect extra cosmetic drops from {list} to flex across {genre}",
  "map out story beats across {list} if you're documenting every {genre} lore drop",
  "alternate between this and {list} to keep your daily quests varied",
  "test experimental loadouts inside {list} where the {genre} community loves theorycrafting",
  "budget your booster packs across {list} for a wider {genre} grind",
  "cozy up with {list} while you wait for new {genre} updates to hit"
];

const GENERIC_PROMPTS = [
  "you can also check out {list} for more Roblox rewards",
  "keep the momentum going with {list}",
  "add {list} to your codes checklist",
  "mix things up with {list}",
  "pad your inventory by visiting {list} next",
  "make sure {list} are on your daily hop list so nothing slips through",
  "if friends ping you for suggestions, send them toward {list}",
  "sprinkle in runs of {list} so you always have backup codes to redeem",
  "the communities inside {list} love sharing tips, so go grab their freebies too",
  "queue these tabs—{list}—and bounce between them when timers reset",
  "give yourself a fresh objective by rotating through {list}",
  "these lobbies—{list}—are perfect when you just want a chill grind",
  "treat {list} as your side quests whenever you finish a session here",
  "consider {list} your emergency stash when other games are dry",
  "bundle {list} into your weekend grind plan to stay stocked",
  "drop into {list} when you feel like discovering new mechanics and minis",
  "keep a notepad of codes from {list} so you're never empty-handed",
  "if you're curating a playlist of games for friends, {list} belongs on it",
  "rotate {list} into your content schedule if you stream or make guides",
  "and hey, take a detour through {list} just to shake up the routine"
];

const logMessage = (logger: ((msg: string) => void) | undefined, message: string) => {
  if (logger) {
    logger(message);
  } else {
    console.log(message);
  }
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const normalize = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const sameGenre = (base: GameRow, other: GameRow): boolean => {
  const baseGenre = normalize(base.genre)?.toLowerCase();
  const otherGenre = normalize(other.genre)?.toLowerCase();
  return Boolean(baseGenre && otherGenre && baseGenre === otherGenre);
};

const sameSubGenre = (base: GameRow, other: GameRow): boolean => {
  const baseSub = normalize(base.sub_genre)?.toLowerCase();
  const otherSub = normalize(other.sub_genre)?.toLowerCase();
  return Boolean(baseSub && otherSub && baseSub === otherSub);
};

const dedupe = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
};

const selectGenreRecommendations = (base: GameRow, pool: GameRow[], minCount: number): GameRow[] => {
  const seed = hashString(base.slug || base.name || base.id);
  const candidates = dedupe([
    ...pool.filter((g) => sameSubGenre(base, g)),
    ...pool.filter((g) => sameGenre(base, g))
  ]);

  if (candidates.length === 0) return [];
  const picks: GameRow[] = [];
  let offset = 0;

  while (picks.length < minCount && offset < candidates.length * 2) {
    const candidate = candidates[(seed + offset) % candidates.length];
    if (candidate.id !== base.id && !picks.some((p) => p.id === candidate.id)) {
      picks.push(candidate);
    }
    offset += 1;
    if (picks.length === candidates.length - 1) break;
  }

  return picks.slice(0, minCount);
};

const selectLowLinkRecommendations = (base: GameRow, pool: GameRow[], minCount: number): GameRow[] => {
  const sorted = pool
    .filter((g) => g.id !== base.id)
    .sort((a, b) => {
      const aLinks = a.internal_links ?? 0;
      const bLinks = b.internal_links ?? 0;
      if (aLinks !== bLinks) return aLinks - bLinks;
      return a.name.localeCompare(b.name);
    });
  return sorted.slice(0, minCount);
};

const formatLinkedList = (games: GameRow[]): string => {
  const links = games.map((g) => `[${g.name}](/${g.slug})`);
  if (links.length === 1) return links[0];
  if (links.length === 2) return `${links[0]} and ${links[1]}`;
  return `${links.slice(0, -1).join(", ")}, and ${links[links.length - 1]}`;
};

const pickDeterministic = <T>(values: T[], seed: number, offset = 0): T => {
  if (!values.length) {
    throw new Error("Cannot pick from an empty array.");
  }
  const index = Math.abs(seed + offset) % values.length;
  return values[index];
};

const buildParagraph = (base: GameRow, recommended: GameRow[], strategy: "genre" | "fallback"): string => {
  const seed = hashString(base.slug || base.name || base.id);
  const opener = pickDeterministic(OPENERS, seed);
  const promptPool = strategy === "genre" ? GENRE_PROMPTS : GENERIC_PROMPTS;
  const prompt = pickDeterministic(promptPool, seed, 7);
  const linkedList = formatLinkedList(recommended);
  const genreLabel = normalize(base.genre) ?? normalize(base.sub_genre) ?? "Roblox";

  const text =
    strategy === "genre"
      ? prompt.replace("{genre}", genreLabel).replace("{list}", linkedList)
      : prompt.replace("{list}", linkedList);
  return `${opener}, ${text}.`;
};

export async function generateLinktextForGames(
  supabase: SupabaseClient,
  options: LinktextOptions = {}
): Promise<LinktextResult> {
  const {
    slugs,
    overwrite = false,
    dryRun = false,
    limit,
    minLinks = DEFAULT_MIN_LINKS,
    logger
  } = options;
  const slugSet = slugs && slugs.length ? new Set(slugs.map((slug) => slug.toLowerCase())) : null;

  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, genre, sub_genre, linktext_md, internal_links, is_published")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const games = (data ?? []).filter((game): game is GameRow => Boolean(game && game.slug && game.name));
  const published = games.filter((game) => game.is_published);
  const pool = published.length ? published : games;

  const targets = games.filter((game) => {
    if (slugSet && !slugSet.has(game.slug.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (!targets.length) {
    logMessage(logger, "No games matched the filter.");
    return {
      updated: 0,
      skippedExisting: 0,
      skippedMissingRecommendations: 0,
      errors: 0
    };
  }

  const increments = new Map<string, number>();
  const summary: LinktextResult = {
    updated: 0,
    skippedExisting: 0,
    skippedMissingRecommendations: 0,
    errors: 0
  };

  for (const game of targets) {
    if (!overwrite && normalize(game.linktext_md)) {
      summary.skippedExisting += 1;
      continue;
    }

    let strategy: "genre" | "fallback" = "genre";
    let recs = selectGenreRecommendations(game, pool, minLinks);
    if (recs.length < minLinks) {
      recs = selectLowLinkRecommendations(game, pool, minLinks);
      strategy = "fallback";
    }

    if (recs.length < minLinks) {
      logMessage(logger, `⚠️  Skipping ${game.name} — only found ${recs.length} recommendation(s).`);
      summary.skippedMissingRecommendations += 1;
      continue;
    }

    const paragraph = buildParagraph(game, recs, strategy);

    if (dryRun) {
      logMessage(logger, `\n[DRY RUN] ${game.name} (${game.slug})`);
      logMessage(logger, `  ${paragraph}`);
      summary.updated += 1;
      if (limit && summary.updated >= limit) {
        logMessage(logger, "Reached update limit, stopping early.");
        break;
      }
      continue;
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({ linktext_md: paragraph })
      .eq("id", game.id);

    if (updateError) {
      summary.errors += 1;
      logMessage(logger, `❌ Failed to update ${game.name}: ${updateError.message}`);
      continue;
    }

    for (const rec of recs) {
      increments.set(rec.id, (increments.get(rec.id) ?? 0) + 1);
    }

    summary.updated += 1;
    logMessage(logger, `✓ ${game.name}: link text updated with ${recs.length} recommendation(s).`);

    if (limit && summary.updated >= limit) {
      logMessage(logger, "Reached update limit, stopping early.");
      break;
    }
  }

  if (!dryRun && increments.size > 0) {
    for (const [gameId, increment] of increments) {
      const current = games.find((g) => g.id === gameId)?.internal_links ?? 0;
      const nextValue = current + increment;
      const { error: linkError } = await supabase
        .from("games")
        .update({ internal_links: nextValue })
        .eq("id", gameId);

      if (linkError) {
        logMessage(logger, `⚠️ Failed to increment internal_links for ${gameId}: ${linkError.message}`);
      }
    }
  }

  return summary;
}
