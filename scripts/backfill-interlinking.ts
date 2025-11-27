import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

type Universe = {
  universe_id: number | null;
  creator_id: number | null;
  creator_name: string | null;
  genre_l1: string | null;
  genre_l2: string | null;
};

type GameRow = {
  id: string;
  name: string;
  slug: string;
  internal_links: number | null;
  interlinking_ai: Record<string, unknown> | null;
  interlinking_ai_copy_md: string | null;
  is_published: boolean;
  universe: Universe | null;
};

type GameQueryRow = Omit<GameRow, "universe"> & {
  universe: Universe[] | Universe | null;
};

type CliOptions = {
  force: boolean;
  limit: number | null;
};

function parseArgs(argv: string[]): CliOptions {
  let force = false;
  let limit: number | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--limit") {
      const next = argv[i + 1];
      if (next && !Number.isNaN(Number(next))) {
        limit = Number(next);
        i += 1;
      }
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value)) limit = value;
    }
  }

  return { force, limit };
}

function normalize(str?: string | null): string | null {
  if (!str) return null;
  const cleaned = str.trim();
  return cleaned.length ? cleaned : null;
}

function devKey(universe?: Universe | null): string | null {
  if (!universe) return null;
  if (universe.creator_id != null) return `id:${universe.creator_id}`;
  const name = normalize(universe.creator_name);
  return name ? `name:${name.toLowerCase()}` : null;
}

function genreKey(universe?: Universe | null): string | null {
  if (!universe) return null;
  const g1 = normalize(universe.genre_l1);
  if (g1) return g1.toLowerCase();
  const g2 = normalize(universe.genre_l2);
  return g2 ? g2.toLowerCase() : null;
}

function formatList(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

type Picked = {
  game: GameRow;
  basis: "developer" | "genre";
};

function sortCandidates(list: GameRow[]): GameRow[] {
  return [...list].sort((a, b) => {
    const aLinks = a.internal_links ?? 0;
    const bLinks = b.internal_links ?? 0;
    if (aLinks !== bLinks) return aLinks - bLinks;
    return a.name.localeCompare(b.name);
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function main() {
  const { force, limit } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
    process.exit(1);
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  const { data: games, error } = await supabase
    .from("games")
    .select(
      `
        id,
        name,
        slug,
        internal_links,
        interlinking_ai,
        interlinking_ai_copy_md,
        is_published,
        universe:roblox_universes(
          universe_id,
          creator_id,
          creator_name,
          genre_l1,
          genre_l2
        )
      `
    )
    .eq("is_published", true);

  if (error) {
    console.error("Failed to load games:", error.message);
    process.exit(1);
  }

  const rows: GameRow[] = ((games ?? []) as GameQueryRow[]).map((g) => ({
    ...g,
    universe: Array.isArray(g.universe) ? g.universe[0] ?? null : g.universe ?? null
  }));
  const baseLinks = new Map(rows.map((g) => [g.id, g.internal_links ?? 0]));

  const byDev = new Map<string, GameRow[]>();
  const byGenre = new Map<string, GameRow[]>();

  for (const g of rows) {
    const dk = devKey(g.universe);
    if (dk) {
      if (!byDev.has(dk)) byDev.set(dk, []);
      byDev.get(dk)!.push(g);
    }
    const gk = genreKey(g.universe);
    if (gk) {
      if (!byGenre.has(gk)) byGenre.set(gk, []);
      byGenre.get(gk)!.push(g);
    }
  }

  const updates: { id: string; interlinking_ai: Record<string, unknown>; interlinking_ai_copy_md: string }[] = [];
  const linkIncrements = new Map<string, number>();

  const candidates = limit ? rows.slice(0, limit) : rows;

  for (const game of candidates) {
    if (!force && game.interlinking_ai_copy_md) {
      continue;
    }

    const dk = devKey(game.universe);
    const gk = genreKey(game.universe);

    const devCandidates = dk ? sortCandidates((byDev.get(dk) || []).filter((g) => g.id !== game.id)) : [];
    const genreCandidates = gk ? sortCandidates((byGenre.get(gk) || []).filter((g) => g.id !== game.id)) : [];

    const picks: Picked[] = [];
    const devQueue = [...devCandidates];
    const genreQueue = [...genreCandidates];

    while (picks.length < 4 && (devQueue.length || genreQueue.length)) {
      const nextDev = devQueue[0];
      const nextGenre = genreQueue[0];
      const pickDev = nextDev && (!nextGenre || (nextDev.internal_links ?? 0) <= (nextGenre.internal_links ?? 0));
      const next = pickDev ? devQueue.shift() : genreQueue.shift();
      if (!next) break;
      picks.push({ game: next, basis: pickDev ? "developer" : "genre" });
    }

    if (!picks.length) continue;

    const devName = normalize(game.universe?.creator_name);
    const genreLabel = normalize(game.universe?.genre_l1) || normalize(game.universe?.genre_l2);

    const promptContext = {
      game: { id: game.id, name: game.name, slug: game.slug },
      developer: devName || null,
      genre: genreLabel || null,
      basis: {
        developer: Boolean(devCandidates.length),
        genre: Boolean(genreCandidates.length)
      },
      picks: picks.map((p) => ({
        id: p.game.id,
        slug: p.game.slug,
        name: p.game.name,
        basis: p.basis
      }))
    };

    const copy = await generateCopy(openai, promptContext);
    if (!copy) continue;

    const meta: Record<string, unknown> = {
      generated_by: "backfill-interlinking-script",
      generated_at: new Date().toISOString(),
      version: 2,
      prompt_context: promptContext
    };

    updates.push({
      id: game.id,
      interlinking_ai: meta,
      interlinking_ai_copy_md: copy
    });

    for (const picked of picks) {
      linkIncrements.set(picked.game.id, (linkIncrements.get(picked.game.id) ?? 0) + 1);
    }
  }

  console.log(`Prepared ${updates.length} page updates and ${linkIncrements.size} internal link increments.`);

  if (!updates.length && !linkIncrements.size) {
    console.log("Nothing to update.");
    return;
  }

  for (const { id, interlinking_ai, interlinking_ai_copy_md } of updates) {
    const { error: upError } = await supabase
      .from("games")
      .update({
        interlinking_ai,
        interlinking_ai_copy_md
      })
      .eq("id", id);
    if (upError) {
      console.error(`Failed to update interlinking copy for ${id}:`, upError.message);
      process.exit(1);
    }
  }

  if (linkIncrements.size) {
    const incrementPayloads = Array.from(linkIncrements.entries()).map(([id, inc]) => {
      const current = baseLinks.get(id) ?? 0;
      return { id, internal_links: current + inc };
    });

    for (const { id, internal_links } of incrementPayloads) {
      const { error: incError } = await supabase
        .from("games")
        .update({ internal_links })
        .eq("id", id);
      if (incError) {
        console.error(`Failed to increment internal_links for ${id}:`, incError.message);
        process.exit(1);
      }
    }
  }

  console.log("Backfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function generateCopy(
  openai: OpenAI,
  context: {
    game: { id: string; name: string; slug: string };
    developer: string | null;
    genre: string | null;
    basis: { developer: boolean; genre: boolean };
    picks: { id: string; slug: string; name: string; basis: "developer" | "genre" }[];
  }
): Promise<string | null> {
  if (!context.picks.length) return null;

  const system = [
    "You are writing one short interlinking sentence for a Roblox codes page.",
    "Tone: crisp, human, not templated, no fluff, 1-2 sentences max.",
    "Link format must be Markdown with inline links: [Game Name codes](/codes/slug).",
    "If there are developer picks, mention they are from the same developer.",
    "If there are genre picks, mention they are genre-similar.",
    "Do not invent games; only use the provided picks.",
    "Do not repeat the game name of the page; focus on alternatives.",
    "Avoid numbered lists or bullets."
  ].join(" ");

  const devPicks = context.picks.filter((p) => p.basis === "developer");
  const genrePicks = context.picks.filter((p) => p.basis === "genre");

  const devLinks = devPicks.map((p) => `[${p.name} codes](/codes/${p.slug})`);
  const genreLinks = genrePicks.map((p) => `[${p.name} codes](/codes/${p.slug})`);

  const user = {
    game: context.game,
    developer: context.developer,
    genre: context.genre,
    developer_picks: devLinks,
    genre_picks: genreLinks
  };

  const completion = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) }
    ]
  });

  const text = (completion.output_text ?? "").trim();
  if (!text) return null;
  return text;
}
