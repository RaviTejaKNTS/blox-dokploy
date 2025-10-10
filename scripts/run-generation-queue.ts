import "dotenv/config";

import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import { normalizeGameSlug } from "@/lib/slug";

type QueueRow = {
  id: string;
  game_name: string;
  status: string;
  attempts?: number;
  last_attempted_at: string | null;
  last_error: string | null;
};

function parseLimit(args: string[]): number {
  const eqArg = args.find((arg) => arg.startsWith("--limit="));
  if (eqArg) {
    const value = eqArg.split("=")[1];
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  const index = args.indexOf("--limit");
  if (index !== -1 && args[index + 1]) {
    const parsed = Number(args[index + 1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  return 1;
}

const LIMIT = parseLimit(process.argv.slice(2));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

async function pickQueueItems(limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("game_generation_queue")
    .select("id, game_name, status, attempts, last_attempted_at, last_error")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load queue: ${error.message}`);
  }

  const candidates = data ?? [];
  if (candidates.length <= limit) {
    return candidates;
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, limit);
}

async function markInProgress(id: string, attempts: number) {
  const { error } = await supabase
    .from("game_generation_queue")
    .update({
      status: "in_progress",
      last_attempted_at: new Date().toISOString(),
      attempts: attempts + 1,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark in-progress: ${error.message}`);
  }
}

async function updateQueueStatus(
  id: string,
  status: "completed" | "failed" | "skipped",
  errorMessage?: string | null
) {
  const payload: Record<string, unknown> = {
    status,
    last_attempted_at: new Date().toISOString(),
    last_error: errorMessage ?? null,
  };

  const { error } = await supabase
    .from("game_generation_queue")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update queue status: ${error.message}`);
  }
}

function runGenerate(gameName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "generate", "--", gameName], {
      stdio: "inherit",
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Generator exited with code ${code}`));
    });
  });
}

async function processQueueItem(entry: QueueRow) {
  const slug = normalizeGameSlug(entry.game_name, entry.game_name);

  const { data: existing, error: existingError } = await supabase
    .from("games")
    .select("id, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check existing game: ${existingError.message}`);
  }

  if (existing?.is_published) {
    console.log(`ℹ️ ${entry.game_name} already published. Marking as skipped.`);
    await updateQueueStatus(entry.id, "skipped");

    await supabase
      .from("game_generation_queue")
      .update({ status: "skipped", last_error: "Slug already published" })
      .neq("id", entry.id)
      .eq("status", "pending")
      .eq("game_name", entry.game_name);
    return;
  }

  try {
    await runGenerate(entry.game_name);
    await updateQueueStatus(entry.id, "completed", null);
    console.log(`✅ Completed generation for ${entry.game_name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Generation failed for ${entry.game_name}: ${message}`);
    await updateQueueStatus(entry.id, "failed", message.slice(0, 500));
  }
}

async function main() {
  try {
    const items = await pickQueueItems(LIMIT);
    if (items.length === 0) {
      console.log("No pending games in queue.");
      return;
    }

    for (const entry of items) {
      await markInProgress(entry.id, entry.attempts ?? 0);
      await processQueueItem(entry);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
