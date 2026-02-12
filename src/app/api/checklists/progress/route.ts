import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_CHECKED_IDS = 2000;

function normalizeSlug(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return "";
  return trimmed;
}

function normalizeCheckedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_CHECKED_IDS) break;
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const url = new URL(request.url);
    const slug = normalizeSlug(url.searchParams.get("slug"));

    if (slug) {
      const { data, error } = await admin
        .from("user_checklist_progress")
        .select("checked_item_ids")
        .eq("user_id", user.id)
        .eq("checklist_slug", slug)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500 });
      }

      const checkedIds = normalizeCheckedIds((data as { checked_item_ids?: unknown } | null)?.checked_item_ids);
      return NextResponse.json(
        { checkedIds },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const { data, error } = await admin
      .from("user_checklist_progress")
      .select("checklist_slug, checked_item_ids")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500 });
    }

    const progress = (data ?? []).map((row) => {
      const checkedIds = normalizeCheckedIds((row as { checked_item_ids?: unknown } | null)?.checked_item_ids);
      return {
        slug: typeof row?.checklist_slug === "string" ? row.checklist_slug : "",
        checkedCount: checkedIds.length
      };
    }).filter((entry) => entry.slug);

    return NextResponse.json(
      { progress },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load checklist progress", error);
    return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const payload = await request.json().catch(() => ({}));
    const slug = normalizeSlug(payload?.slug ?? null);
    const checkedIds = normalizeCheckedIds(payload?.checkedIds);

    if (!slug) {
      return NextResponse.json({ error: "Checklist slug is required." }, { status: 400 });
    }

    if (checkedIds.length === 0) {
      const { error } = await admin
        .from("user_checklist_progress")
        .delete()
        .eq("user_id", user.id)
        .eq("checklist_slug", slug);

      if (error) {
        return NextResponse.json({ error: "Unable to clear checklist progress." }, { status: 500 });
      }

      return NextResponse.json({ checkedIds: [] });
    }

    const { error } = await admin
      .from("user_checklist_progress")
      .upsert(
        {
          user_id: user.id,
          checklist_slug: slug,
          checked_item_ids: checkedIds
        },
        { onConflict: "user_id,checklist_slug" }
      );

    if (error) {
      return NextResponse.json({ error: "Unable to save checklist progress." }, { status: 500 });
    }

    return NextResponse.json({ checkedIds });
  } catch (error) {
    console.error("Failed to save checklist progress", error);
    return NextResponse.json({ error: "Unable to save checklist progress." }, { status: 500 });
  }
}
