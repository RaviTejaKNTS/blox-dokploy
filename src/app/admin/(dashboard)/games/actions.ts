"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/admin-auth";
import { computeGameDetails, syncGameCodesFromSources } from "@/lib/admin/game-import";

const upsertGameSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  author_id: z.string().uuid().nullable().optional(),
  is_published: z.boolean(),
  source_url: z.string().url().nullable().optional(),
  source_url_2: z.string().url().nullable().optional(),
  source_url_3: z.string().url().nullable().optional(),
  intro_md: z.string().nullable().optional(),
  redeem_md: z.string().nullable().optional(),
  description_md: z.string().nullable().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  cover_image: z.string().nullable().optional()
});

const gameCodeSchema = z.object({
  game_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  status: z.enum(["active", "check", "expired"]),
  rewards_text: z.string().nullable().optional(),
  level_requirement: z.number().int().nullable().optional(),
  is_new: z.boolean().optional()
});

function formDataToObject(form: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(form as unknown as Iterable<[string, FormDataEntryValue]>);
}

export async function saveGame(form: FormData) {
  const raw = formDataToObject(form);
  try {
    const payload = upsertGameSchema.parse({
      id: raw.id ? String(raw.id) : undefined,
      name: String(raw.name ?? ""),
      slug: String(raw.slug ?? ""),
      author_id: raw.author_id ? String(raw.author_id) : null,
      is_published: raw.is_published === "on" || raw.is_published === "true",
      source_url: raw.source_url ? String(raw.source_url) : null,
      source_url_2: raw.source_url_2 ? String(raw.source_url_2) : null,
      source_url_3: raw.source_url_3 ? String(raw.source_url_3) : null,
      intro_md: raw.intro_md ? String(raw.intro_md) : null,
      redeem_md: raw.redeem_md ? String(raw.redeem_md) : null,
      description_md: raw.description_md ? String(raw.description_md) : null,
      seo_title: raw.seo_title ? String(raw.seo_title) : null,
      seo_description: raw.seo_description ? String(raw.seo_description) : null,
      cover_image: raw.cover_image ? String(raw.cover_image) : null
    });

    const { supabase } = await requireAdminAction();

    const { slug, name } = computeGameDetails({
      name: payload.name,
      slug: payload.slug,
      sourceUrl: payload.source_url ?? undefined
    });

    const normalizeOptionalUrl = (value: string | null | undefined) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const record = {
      name,
      slug,
      author_id: payload.author_id,
      is_published: payload.is_published,
      source_url: normalizeOptionalUrl(payload.source_url),
      source_url_2: normalizeOptionalUrl(payload.source_url_2),
      source_url_3: normalizeOptionalUrl(payload.source_url_3),
      intro_md: payload.intro_md,
      redeem_md: payload.redeem_md,
      description_md: payload.description_md,
      seo_title: payload.seo_title,
      seo_description: payload.seo_description,
      cover_image: payload.cover_image
    };

    type GameRecord = {
      id: string;
      slug: string;
      name: string;
      source_url: string | null;
      source_url_2: string | null;
      source_url_3: string | null;
      is_published: boolean | null;
    };

    let game: GameRecord | null = null;

    if (payload.id) {
      const { data, error } = await supabase
        .from("games")
        .update(record)
        .eq("id", payload.id)
        .select("id, slug, name, source_url, source_url_2, source_url_3, is_published")
        .single();

      if (error) {
        return { success: false, error: error.message, code: (error as any).code ?? null };
      }
      game = (data as GameRecord) ?? null;
    } else {
      const { data, error } = await supabase
        .from("games")
        .insert(record)
        .select("id, slug, name, source_url, source_url_2, source_url_3, is_published")
        .single();

      if (error) {
        return { success: false, error: error.message, code: (error as any).code ?? null };
      }
      game = (data as GameRecord) ?? null;
    }

    if (!game) {
      return { success: false, error: "Game record was not returned." };
    }

    const syncResult = await syncGameCodesFromSources(supabase, game.id, [
      game.source_url,
      game.source_url_2,
      game.source_url_3
    ]);

    revalidatePath("/admin/games");
    return {
      success: true,
      slug: game.slug,
      codesFound: syncResult.codesFound,
      codesUpserted: syncResult.codesUpserted,
      syncErrors: syncResult.errors
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unexpected error occurred" };
  }
}

export async function upsertGameCode(form: FormData) {
  const raw = formDataToObject(form);
  const payload = gameCodeSchema.parse({
    game_id: String(raw.game_id ?? ""),
    id: raw.id ? String(raw.id) : undefined,
    code: String(raw.code ?? ""),
    status: String(raw.status ?? "active"),
    rewards_text: raw.rewards_text ? String(raw.rewards_text) : null,
    level_requirement: raw.level_requirement ? Number(raw.level_requirement) : null,
    is_new: raw.is_new === "on" || raw.is_new === "true"
  });

  const { supabase } = await requireAdminAction();

  const { error } = await supabase.rpc("upsert_code", {
    p_game_id: payload.game_id,
    p_code: payload.code,
    p_status: payload.status,
    p_rewards_text: payload.rewards_text,
    p_level_requirement: payload.level_requirement,
    p_is_new: payload.is_new ?? false
  });

  if (error) throw error;

  revalidatePath("/admin/games");
  return { success: true };
}

export async function updateCodeStatus(form: FormData) {
  const payload = gameCodeSchema.pick({ game_id: true, id: true, status: true }).parse({
    game_id: String(form.get("game_id") ?? ""),
    id: String(form.get("id") ?? ""),
    status: String(form.get("status") ?? "active")
  });

  const { supabase } = await requireAdminAction();

  const { error } = await supabase
    .from("codes")
    .update({ status: payload.status })
    .eq("id", payload.id);

  if (error) throw error;

  revalidatePath("/admin/games");
  return { success: true };
}

export async function deleteCode(form: FormData) {
  const { supabase } = await requireAdminAction();
  const id = String(form.get("id") ?? "");

  const { error } = await supabase
    .from("codes")
    .delete()
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/admin/games");
  return { success: true };
}

function normalizeCodeForComparison(code: string | null | undefined) {
  if (!code) return null;
  return code.replace(/\s+/g, "").trim();
}

export async function refreshGameCodes(slug: string) {
  const { supabase } = await requireAdminAction();

  const { data: game, error } = await supabase
    .from("games")
    .select("id, slug, name, source_url, source_url_2, source_url_3")
    .eq("slug", slug)
    .single();

  if (error || !game) {
    return { success: false, error: error?.message ?? "Game not found" };
  }

  const sources = [game.source_url, game.source_url_2, game.source_url_3];
  const syncResult = await syncGameCodesFromSources(supabase, game.id, sources);

  if (syncResult.errors.length) {
    return { success: false, error: syncResult.errors.join(", ") };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("codes")
    .select("code, status")
    .eq("game_id", game.id);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const incomingNormalized = new Set(
    (syncResult.codes ?? []).map((entry) => normalizeCodeForComparison(entry.code)).filter((value): value is string => Boolean(value))
  );

  const toDelete = (existingRows ?? [])
    .filter((row) => row.status === "active" || row.status === "check")
    .map((row) => ({
      normalized: normalizeCodeForComparison(row.code),
      original: row.code
    }))
    .filter((entry) => entry.normalized && !incomingNormalized.has(entry.normalized))
    .map((entry) => entry.original)
    .filter((code): code is string => Boolean(code));

  if (toDelete.length) {
    const { error: deleteError } = await supabase
      .from("codes")
      .delete()
      .eq("game_id", game.id)
      .in("code", toDelete);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
  }

  revalidatePath("/admin/games");
  return {
    success: true,
    found: syncResult.codesFound,
    upserted: syncResult.codesUpserted,
    removed: toDelete.length
  };
}
