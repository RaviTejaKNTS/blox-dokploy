import 'dotenv/config';
import { scrapeSources } from "@/lib/scraper";
import { supabaseAdmin } from "@/lib/supabase";
import type { Game } from "@/lib/db";

const PAGE_SIZE = Number(process.env.REFRESH_PAGE_SIZE ?? 500);
const CONCURRENCY = Math.max(1, Number(process.env.REFRESH_CONCURRENCY ?? 5));
const BATCH_DELAY_MS = Number(process.env.REFRESH_BATCH_DELAY_MS ?? 500);
const ONLY_SLUGS = (process.env.REFRESH_ONLY_SLUGS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function normalizeCodeForComparison(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.replace(/\s+/g, "").trim().toUpperCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GameRow = Game & {
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
};

type ProcessResult = {
  slug: string;
  name: string;
  status: "ok" | "skipped" | "error";
  found?: number;
  upserted?: number;
  removed?: number;
  error?: string;
};

async function fetchPublishedGames() {
  const sb = supabaseAdmin();
  const all: GameRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("games")
      .select("*")
      .eq("is_published", true)
      .order("name", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const chunk = (data ?? []) as GameRow[];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { sb, games: all };
}

async function processGame(sb: ReturnType<typeof supabaseAdmin>, game: GameRow): Promise<ProcessResult> {
  const sourceUrls = [game.source_url, game.source_url_2, game.source_url_3]
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0);

  if (sourceUrls.length === 0) {
    return { slug: game.slug, name: game.name, status: "skipped" };
  }

  const { codes } = await scrapeSources(sourceUrls);

  const incomingNormalized = new Set<string>();
  for (const c of codes) {
    const normalized = normalizeCodeForComparison(c.code);
    if (normalized) {
      incomingNormalized.add(normalized);
    }
  }

  const { data: existingRows, error: existingError } = await sb
    .from("codes")
    .select("code, status")
    .eq("game_id", game.id);

  if (existingError) {
    throw new Error(`failed to load existing codes for ${game.slug}: ${existingError.message}`);
  }

  let upserted = 0;

  for (const c of codes) {
    const { error } = await sb.rpc("upsert_code", {
      p_game_id: game.id,
      p_code: c.code,
      p_status: c.status,
      p_rewards_text: c.rewardsText ?? null,
      p_level_requirement: c.levelRequirement ?? null,
      p_is_new: c.isNew ?? false,
    });

    if (error) {
      throw new Error(`upsert failed for ${c.code}: ${error.message}`);
    }

    upserted += 1;
  }

  const existingActiveOrCheck = (existingRows ?? []).filter(
    (row) => row.status === "active" || row.status === "check"
  );

  const toDelete = existingActiveOrCheck
    .map((row) => {
      const normalized = normalizeCodeForComparison(row.code);
      return { normalized, original: row.code };
    })
    .filter((entry) => entry.normalized && !incomingNormalized.has(entry.normalized))
    .map((entry) => entry.original)
    .filter((code): code is string => Boolean(code));

  if (toDelete.length) {
    const { error: deleteError } = await sb
      .from("codes")
      .delete()
      .eq("game_id", game.id)
      .in("code", toDelete);

    if (deleteError) {
      throw new Error(`cleanup failed for ${game.slug}: ${deleteError.message}`);
    }
  }

  return {
    slug: game.slug,
    name: game.name,
    status: "ok",
    found: codes.length,
    upserted,
    removed: toDelete.length,
  };
}

async function main() {
  console.log("\n▶ Refresh run started");
  if (ONLY_SLUGS.length) {
    console.log(`   Filtering to slugs: ${ONLY_SLUGS.join(", ")}`);
  }

  const { sb, games } = await fetchPublishedGames();
  const candidates = games.filter((g) => !ONLY_SLUGS.length || ONLY_SLUGS.includes(g.slug));

  if (!candidates.length) {
    console.log("No games to refresh. Exiting.");
    return;
  }

  console.log(`Found ${candidates.length} published games to refresh (page size ${PAGE_SIZE}, concurrency ${CONCURRENCY}).`);

  const stats = {
    processed: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    totalCodesFound: 0,
    totalCodesUpserted: 0,
    totalCodesRemoved: 0,
  };

  for (let idx = 0; idx < candidates.length; idx += CONCURRENCY) {
    const batch = candidates.slice(idx, idx + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (game) => {
        try {
          const result = await processGame(sb, game);
          return result;
        } catch (err: any) {
          return {
            slug: game.slug,
            name: game.name,
            status: "error" as const,
            error: err?.message ?? String(err),
          };
        }
      })
    );

    for (const res of results) {
      stats.processed += 1;
      if (res.status === "ok") {
        stats.success += 1;
        stats.totalCodesFound += res.found ?? 0;
        stats.totalCodesUpserted += res.upserted ?? 0;
        stats.totalCodesRemoved += res.removed ?? 0;
        const removedNote = res.removed ? `, removed ${res.removed}` : "";
        console.log(
          `✔ ${res.slug} — ${res.upserted ?? 0} codes upserted (found ${res.found ?? 0}${removedNote})`
        );
      } else if (res.status === "skipped") {
        stats.skipped += 1;
        console.log(`↷ ${res.slug} — skipped (missing source URLs)`);
      } else {
        stats.failed += 1;
        console.error(`✖ ${res.slug} — ${res.error}`);
      }
    }

    if (BATCH_DELAY_MS > 0 && idx + CONCURRENCY < candidates.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("\n▶ Refresh summary");
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Succeeded: ${stats.success}`);
  console.log(`   Skipped:   ${stats.skipped}`);
  console.log(`   Failed:    ${stats.failed}`);
  console.log(`   Codes found:    ${stats.totalCodesFound}`);
  console.log(`   Codes upserted: ${stats.totalCodesUpserted}`);
  console.log(`   Codes removed:  ${stats.totalCodesRemoved}`);

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal refresh error", err);
  process.exit(1);
});
