import "dotenv/config";

import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

type QueueRow = {
  id: string;
  article_title: string | null;
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
    .from("article_generation_queue")
    .select("id, article_title, status, attempts, last_attempted_at, last_error")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load article queue: ${error.message}`);
  }

  return data ?? [];
}

async function markAttempt(id: string, attempts: number) {
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      attempts: attempts + 1,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to record attempt: ${error.message}`);
  }
}

function runGenerator(queueId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "generate:article", "--", "--queue-id", queueId], {
      stdio: "inherit"
    });

    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Article generator exited with code ${code}`));
    });
  });
}

async function markFailed(id: string, message: string) {
  const truncated = message.slice(0, 500);
  const { error } = await supabase
    .from("article_generation_queue")
    .update({
      status: "failed",
      last_error: truncated,
      last_attempted_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark queue row failed: ${error.message}`);
  }
}

async function processQueueItem(entry: QueueRow) {
  const label = entry.article_title?.trim() || "Untitled article";
  console.log(`📰 Processing article queue item ${label} (${entry.id})`);
  await markAttempt(entry.id, entry.attempts ?? 0);

  try {
    await runGenerator(entry.id);
    console.log(`✅ Article generated for queue item ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to generate article for queue item ${label}: ${message}`);
    await markFailed(entry.id, message);
  }
}

async function main() {
  try {
    const items = await pickQueueItems(LIMIT);
    if (items.length === 0) {
      console.log("No pending articles in queue.");
      return;
    }

    for (const entry of items) {
      await processQueueItem(entry);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
