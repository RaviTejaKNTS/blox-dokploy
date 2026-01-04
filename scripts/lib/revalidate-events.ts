import { supabaseAdmin } from "@/lib/supabase";

const REVALIDATE_ENDPOINT = process.env.REVALIDATE_ENDPOINT;
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;
const PAGE_LOOKUP_BATCH = 200;

let warnedMissingConfig = false;

function normalizeSlug(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function ensureRevalidateConfig(): boolean {
  if (REVALIDATE_ENDPOINT && REVALIDATE_SECRET) return true;
  if (!warnedMissingConfig) {
    console.warn("Revalidation skipped: set REVALIDATE_ENDPOINT and REVALIDATE_SECRET to enable event page refresh.");
    warnedMissingConfig = true;
  }
  return false;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function postEventRevalidate(slug: string): Promise<void> {
  if (!ensureRevalidateConfig()) return;
  const res = await fetch(REVALIDATE_ENDPOINT as string, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REVALIDATE_SECRET}`
    },
    body: JSON.stringify({ type: "event", slug })
  });

  if (res.ok) return;
  const body = await res.text().catch(() => "");
  console.warn(`Event revalidate failed for ${slug}: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
}

export async function revalidateEventSlugs(slugs: Array<string | null | undefined>): Promise<void> {
  const unique = new Set<string>();
  slugs
    .map((slug) => normalizeSlug(slug))
    .filter((slug): slug is string => Boolean(slug))
    .forEach((slug) => unique.add(slug));

  if (!unique.size) return;
  if (!ensureRevalidateConfig()) return;

  for (const slug of unique) {
    await postEventRevalidate(slug);
  }
}

export async function revalidateEventsByUniverseIds(universeIds: number[]): Promise<void> {
  const uniqueIds = Array.from(
    new Set(universeIds.filter((id) => typeof id === "number" && Number.isFinite(id)))
  );
  if (!uniqueIds.length) return;
  if (!ensureRevalidateConfig()) return;

  const sb = supabaseAdmin();
  const slugs = new Set<string>();

  for (const chunk of chunkArray(uniqueIds, PAGE_LOOKUP_BATCH)) {
    const { data, error } = await sb
      .from("events_pages")
      .select("slug")
      .in("universe_id", chunk)
      .eq("is_published", true)
      .not("slug", "is", null);

    if (error) {
      console.warn(`Event revalidate lookup failed: ${error.message}`);
      continue;
    }

    (data ?? []).forEach((row) => {
      const slug = normalizeSlug((row as { slug?: string | null }).slug);
      if (slug) slugs.add(slug);
    });
  }

  if (!slugs.size) return;

  for (const slug of slugs) {
    await postEventRevalidate(slug);
  }
}
