import "dotenv/config";
import { promises as fs } from "node:fs";
import { detectProvider, getCodeDisplayPriority, scrapeSources } from "@/lib/scraper";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Game } from "@/lib/db";
import { sanitizeCodeDisplay, normalizeCodeKey } from "@/lib/code-normalization";

const PAGE_SIZE = Number(process.env.REFRESH_PAGE_SIZE ?? 500);
const CONCURRENCY = Math.max(1, Number(process.env.REFRESH_CONCURRENCY ?? 5));
const BATCH_DELAY_MS = Number(process.env.REFRESH_BATCH_DELAY_MS ?? 500);
const ONLY_SLUGS = (process.env.REFRESH_ONLY_SLUGS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function collectSlugsFromArgs(): string[] {
  const args = process.argv.slice(2);
  const slugs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--slug" || arg === "-s") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("Missing value for --slug option");
      }
      slugs.push(value.trim());
      i += 1;
    } else if (arg.startsWith("--slug=")) {
      slugs.push(arg.slice("--slug=".length).trim());
    }
  }

  return slugs.filter(Boolean);
}

const CLI_SLUGS = collectSlugsFromArgs();
const TARGET_SLUGS = Array.from(new Set([...ONLY_SLUGS, ...CLI_SLUGS]));

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
  expired?: number;
  newCodes?: number;
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

  const enabledUrls = sourceUrls.filter((url) => {
    try {
      return Boolean(detectProvider(url));
    } catch {
      return false;
    }
  });

  if (enabledUrls.length === 0) {
    return { slug: game.slug, name: game.name, status: "skipped", error: "all sources disabled or unsupported" };
  }

  const { codes, expiredCodes } = await scrapeSources(enabledUrls);
  let newCodesCount = 0;
  const scrapedExpired = expiredCodes ?? [];

  const expiredByNormalized = new Map<string, { display: string; priority: number }>();
  const setExpired = (normalized: string, display: string, priority: number) => {
    const existing = expiredByNormalized.get(normalized);
    if (!existing || priority > existing.priority) {
      expiredByNormalized.set(normalized, { display, priority });
    }
  };

  const incomingNormalized = new Set<string>();

  const existingExpiredArray = Array.isArray(game.expired_codes) ? game.expired_codes : [];
  for (const code of existingExpiredArray) {
    const displayCode = sanitizeCodeDisplay(code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (normalized) {
      setExpired(normalized, displayCode, -1);
    }
  }

  for (const raw of scrapedExpired) {
    const displayCode = sanitizeCodeDisplay(typeof raw === "string" ? raw : raw?.code);
    if (!displayCode) continue;
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) continue;
    const provider = typeof raw === "string" ? undefined : raw?.provider;
    const priority = getCodeDisplayPriority(provider);
    setExpired(normalized, displayCode, priority);
  }

  const { data: existingRows, error: existingError } = await sb
    .from("codes")
    .select("code, status, provider_priority, first_seen_at")
    .eq("game_id", game.id);

  if (existingError) {
    throw new Error(`failed to load existing codes for ${game.slug}: ${existingError.message}`);
  }

  const existingNormalizedMap = new Map<string, { code: string; providerPriority: number; status: string; firstSeenAt?: string | null }>();
  const expiredInDb = new Set<string>();
  for (const row of existingRows ?? []) {
    const existingCode = sanitizeCodeDisplay(row.code);
    if (!existingCode) continue;
    const normalized = normalizeCodeKey(existingCode);
    if (!normalized) continue;
    const providerPriority = Number(row.provider_priority ?? 0);
    if (row.status === "expired") {
      expiredInDb.add(normalized);
    }
    if (existingNormalizedMap.has(normalized)) {
      const current = existingNormalizedMap.get(normalized)!;
      if (current.providerPriority >= providerPriority) {
        continue;
      }
    }
    existingNormalizedMap.set(normalized, { code: existingCode, providerPriority, status: row.status, firstSeenAt: row.first_seen_at });
  }

  let upserted = 0;

  for (let i = codes.length - 1; i >= 0; i -= 1) {
    const c = codes[i];
    const displayCode = sanitizeCodeDisplay(c.code);
    if (!displayCode) {
      continue;
    }
    const normalized = normalizeCodeKey(displayCode);
    if (!normalized) {
      continue;
    }
    const providerPriority = Number(c.providerPriority ?? getCodeDisplayPriority(c.provider) ?? 0);
    const expiredEntry = expiredByNormalized.get(normalized);
    if (expiredEntry) {
      if (expiredEntry.priority >= providerPriority) {
        continue; // expired wins for equal or higher priority
      }
      expiredByNormalized.delete(normalized); // higher priority active overrides expired
    }
    incomingNormalized.add(normalized);

    // Skip if a code with the same normalized value already exists for this game
    const existingEntry = existingNormalizedMap.get(normalized);
    if (existingEntry) {
      const existingExpired = existingEntry.status === "expired";
      const higherPriorityExists = existingEntry.providerPriority > providerPriority;
      const samePrioritySameDisplay = existingEntry.providerPriority === providerPriority && existingEntry.code === displayCode;

      if (!existingExpired && (higherPriorityExists || samePrioritySameDisplay)) {
        // Still touch the row to refresh last_seen_at without overwriting provider priority
        const { error: touchError } = await sb
          .from("codes")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("game_id", game.id)
          .ilike("code", existingEntry.code);

        if (touchError) {
          throw new Error(`failed to refresh last_seen_at for ${displayCode}: ${touchError.message}`);
        }

        existingNormalizedMap.set(normalized, {
          code: existingEntry.code,
          providerPriority: existingEntry.providerPriority,
          status: existingEntry.status,
          firstSeenAt: existingEntry.firstSeenAt,
        });
        continue;
      }
    }

    c.code = displayCode;
    if (c.isNew) {
      newCodesCount += 1;
    }

    const status = c.status === "check" ? "expired" : c.status;
    const shouldResetFirstSeen = status === "active" && expiredInDb.has(normalized);
    const { error } = await sb.rpc("upsert_code", {
      p_game_id: game.id,
      p_code: displayCode,
      p_status: status,
      p_rewards_text: c.rewardsText ?? null,
      p_level_requirement: c.levelRequirement ?? null,
      p_is_new: c.isNew ?? false,
      p_provider_priority: providerPriority,
    });

    if (error) {
      throw new Error(`upsert failed for ${c.code}: ${error.message}`);
    }

    if (shouldResetFirstSeen) {
      const nowIso = new Date().toISOString();
      const { error: resetError } = await sb
        .from("codes")
        .update({ first_seen_at: nowIso })
        .eq("game_id", game.id)
        .ilike("code", displayCode);

      if (resetError) {
        throw new Error(`failed to reset first_seen_at for ${displayCode}: ${resetError.message}`);
      }
      existingNormalizedMap.set(normalized, {
        code: displayCode,
        providerPriority,
        status,
        firstSeenAt: nowIso,
      });
    } else {
      existingNormalizedMap.set(normalized, {
        code: displayCode,
        providerPriority,
        status,
        firstSeenAt: existingEntry?.firstSeenAt,
      });
    }

    upserted += 1;
  }

  const existingCheckRows = (existingRows ?? []).filter((row) => row.status === "check");
  if (existingCheckRows.length) {
    const codesToMove = existingCheckRows
      .map((row) => sanitizeCodeDisplay(row.code))
      .filter((code): code is string => Boolean(code));

    if (codesToMove.length) {
      const { error: moveError } = await sb
        .from("codes")
        .update({
          status: "expired",
          is_new: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq("game_id", game.id)
        .in("code", codesToMove);

      if (moveError) {
        throw new Error(`failed to convert check codes to expired for ${game.slug}: ${moveError.message}`);
      }

      for (const code of codesToMove) {
        const normalized = normalizeCodeKey(code);
        if (normalized) {
          setExpired(normalized, code, 0);
        }
      }
    }
  }

  const existingActiveOrCheck = (existingRows ?? []).filter((row) => row.status === "active");

  const toExpireEntries = existingActiveOrCheck
    .map((row) => {
      const displayCode = sanitizeCodeDisplay(row.code);
      if (!displayCode) return null;
      const normalized = normalizeCodeKey(displayCode);
      if (!normalized) return null;
      return { normalized, original: displayCode };
    })
    .filter((entry): entry is { normalized: string; original: string } => {
      if (!entry) return false;
      return !incomingNormalized.has(entry.normalized);
    });

  if (toExpireEntries.length) {
    const codesToExpire = toExpireEntries.map((entry) => entry.original);
    const { error: expireError } = await sb
      .from("codes")
      .update({
        status: "expired",
        is_new: false,
        last_seen_at: new Date().toISOString(),
      })
      .eq("game_id", game.id)
      .in("code", codesToExpire);

    if (expireError) {
      throw new Error(`expiration update failed for ${game.slug}: ${expireError.message}`);
    }

    for (const entry of toExpireEntries) {
      setExpired(entry.normalized, entry.original, 0);
    }
  }
  const updatedExpiredCodes = Array.from(expiredByNormalized.values()).map((entry) => entry.display);
  let expiredArrayChanged = false;
  if (updatedExpiredCodes.length !== existingExpiredArray.length) {
    expiredArrayChanged = true;
  } else {
    for (let i = 0; i < updatedExpiredCodes.length; i += 1) {
      if (updatedExpiredCodes[i] !== existingExpiredArray[i]) {
        expiredArrayChanged = true;
        break;
      }
    }
  }

  if (expiredArrayChanged) {
    const { error: expiredUpdateError } = await sb
      .from("games")
      .update({ expired_codes: updatedExpiredCodes })
      .eq("id", game.id);

    if (expiredUpdateError) {
      throw new Error(`failed to update expired_codes for ${game.slug}: ${expiredUpdateError.message}`);
    }
  }

  return {
    slug: game.slug,
    name: game.name,
    status: "ok",
    found: codes.length,
    upserted,
    expired: toExpireEntries.length,
    newCodes: newCodesCount,
  };
}

async function main() {
  console.log("\n▶ Refresh run started");
  if (TARGET_SLUGS.length) {
    console.log(`   Filtering to slugs: ${TARGET_SLUGS.join(", ")}`);
  }

  const { sb, games } = await fetchPublishedGames();
  const candidates = games.filter((g) => !TARGET_SLUGS.length || TARGET_SLUGS.includes(g.slug));

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
    totalCodesExpired: 0,
    totalNewCodes: 0,
  };

  const successDetails: ProcessResult[] = [];
  const skippedDetails: ProcessResult[] = [];
  const failureDetails: ProcessResult[] = [];

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
        stats.totalCodesExpired += res.expired ?? 0;
        stats.totalNewCodes += res.newCodes ?? 0;
        const expiredNote = res.expired ? `, expired ${res.expired}` : "";
        console.log(
          `✔ ${res.slug} — ${res.upserted ?? 0} codes upserted (found ${res.found ?? 0}${expiredNote})`
        );
        successDetails.push({
          slug: res.slug,
          name: res.name,
          status: "ok",
          found: res.found ?? 0,
          upserted: res.upserted ?? 0,
          expired: res.expired ?? 0,
          newCodes: res.newCodes ?? 0,
        });
      } else if (res.status === "skipped") {
        stats.skipped += 1;
        const reason = res.error ? ` (${res.error})` : " (missing source URLs)";
        console.log(`↷ ${res.slug} — skipped${reason}`);
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

  console.log("\n▶ Refresh summary");
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Succeeded: ${stats.success}`);
  console.log(`   Skipped:   ${stats.skipped}`);
  console.log(`   Failed:    ${stats.failed}`);
  console.log(`   Codes found:    ${stats.totalCodesFound}`);
  console.log(`   Codes upserted: ${stats.totalCodesUpserted}`);
  console.log(`   Codes expired: ${stats.totalCodesExpired}`);
  console.log(`   New codes:      ${stats.totalNewCodes}`);

  if (stats.failed > 0) {
    process.exitCode = 1;
  }

  const summaryPath = process.env.AUTOMATION_SUMMARY_PATH;
  if (summaryPath) {
    const summary = {
      type: "refresh-codes" as const,
      generatedAt: new Date().toISOString(),
      stats,
      successes: successDetails.filter((detail) => detail.upserted || detail.expired || detail.newCodes),
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
  console.error("Fatal refresh error", err);
  process.exit(1);
});
