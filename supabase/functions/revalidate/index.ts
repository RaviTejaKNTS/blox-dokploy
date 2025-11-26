// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EventRow = { id: string; entity_type: "code" | "article" | "list" | "author"; slug: string };

// Accept both legacy and dashboard-provided env names.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const revalidateEndpoint = Deno.env.get("REVALIDATE_ENDPOINT");
const revalidateSecret = Deno.env.get("REVALIDATE_SECRET");

const supabase = createClient(supabaseUrl, serviceRoleKey);

function logInfo(message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", message, ...data }));
}

function logError(message: string, data?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", message, ...data }));
}

async function fetchEvents(limit = 50): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("revalidation_events")
    .select("id, entity_type, slug")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

async function deleteEvents(ids: string[]) {
  if (!ids.length) return;
  await supabase.from("revalidation_events").delete().in("id", ids);
}

async function revalidateEvent(event: EventRow): Promise<boolean> {
  if (!revalidateEndpoint || !revalidateSecret) return false;
  const res = await fetch(revalidateEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${revalidateSecret}`
    },
    body: JSON.stringify({ type: event.entity_type, slug: event.slug })
  });
  if (!res.ok) {
    logError("Revalidate request failed", { status: res.status, statusText: res.statusText, event });
  }
  return res.ok;
}

serve(async (req) => {
  if (!revalidateEndpoint || !revalidateSecret) {
    logError("Missing REVALIDATE env vars");
    return new Response(
      JSON.stringify({ error: "Missing REVALIDATE_ENDPOINT or REVALIDATE_SECRET env vars" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const events = await fetchEvents(100);
    logInfo("Fetched events", { count: events.length });
    const successIds: string[] = [];
    const failures: EventRow[] = [];

    for (const event of events) {
      const ok = await revalidateEvent(event);
      if (ok) {
        successIds.push(event.id);
      } else {
        failures.push(event);
      }
    }

    if (successIds.length) {
      await deleteEvents(successIds);
    }

    logInfo("Batch result", {
      processed: successIds.length,
      failed: failures.length,
      failedEvents: failures.map((f) => ({ type: f.entity_type, slug: f.slug }))
    });

    return new Response(
      JSON.stringify({
        processed: successIds.length,
        failed: failures.length,
        failures
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("Unhandled error", { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
