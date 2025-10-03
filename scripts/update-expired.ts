import "dotenv/config";
import { promises as fs } from "node:fs";
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

type GameRow = Game & {
  source_url: string | null;
  source_url_2: string | null;
  source_url_3: string | null;
};

type ProcessResult = {
  slug: string;
  name: string;
  status: "ok" | "skipped" | "error";
  expired?: number;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function processExpiredCodes(sb: ReturnType<typeof supabaseAdmin>, game: GameRow): Promise<ProcessResult> {
  const sourceUrls = [game.source_url, game.source_url_2, game.source_url_3]
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0);

  if (sourceUrls.length === 0) {
    return { slug: game.slug, name: game.name, status: "skipped" };
  }

  const { expiredCodes } = await scrapeSources(sourceUrls);

  await sb
    .from("games")
    .update({ expired_codes: expiredCodes })
    .eq("id", game.id);

  await sb
    .from("codes")
    .delete()
    .eq("game_id", game.id)
    .eq("status", "expired");

  return {
    slug: game.slug,
    name: game.name,
    status: "ok",
    expired: expiredCodes.length,
  };
}

async function main() {
  console.log("\n▶ Expired codes refresh started");
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
    totalExpired: 0,
  };

  const successDetails: ProcessResult[] = [];
  const skippedDetails: ProcessResult[] = [];
  const failureDetails: ProcessResult[] = [];

  for (let idx = 0; idx < candidates.length; idx += CONCURRENCY) {
    const batch = candidates.slice(idx, idx + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (game) => {
        try {
          const result = await processExpiredCodes(sb, game);
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
        stats.totalExpired += res.expired ?? 0;
        console.log(`✔ ${res.slug} — ${res.expired ?? 0} expired codes captured`);
        successDetails.push({
          slug: res.slug,
          name: res.name,
          status: "ok",
          expired: res.expired ?? 0,
        });
      } else if (res.status === "skipped") {
        stats.skipped += 1;
        console.log(`↷ ${res.slug} — skipped (missing source URLs)`);
        skippedDetails.push(res);
      } else {
        stats.failed += 1;
        console.error(`✖ ${res.slug} — ${res.error}`);
        failureDetails.push(res);
      }
    }

    if (BATCH_DELAY_MS > 0 && idx + CONCURRENCY < candidates.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("\n▶ Expired codes refresh summary");
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Succeeded: ${stats.success}`);
  console.log(`   Skipped:   ${stats.skipped}`);
  console.log(`   Failed:    ${stats.failed}`);
  console.log(`   Expired codes tracked: ${stats.totalExpired}`);

  if (stats.failed > 0) {
    process.exitCode = 1;
  }

  const summaryPath = process.env.AUTOMATION_SUMMARY_PATH;
  if (summaryPath) {
    const summary = {
      type: "refresh-expired" as const,
      generatedAt: new Date().toISOString(),
      stats,
      successes: successDetails,
      skipped: skippedDetails,
      failures: failureDetails,
    };

    try {
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to write automation summary", error);
    }
  }
}

main().catch((err) => {
  console.error("Fatal expired refresh error", err);
  process.exit(1);
});
