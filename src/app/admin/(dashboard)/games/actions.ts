"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/admin-auth";
import { Buffer } from "node:buffer";
import sharp from "sharp";
import { computeGameDetails, syncGameCodesFromSources } from "@/lib/admin/game-import";
import { refreshGameCodesWithSupabase } from "@/lib/admin/game-refresh";
import { ensureCategoryForGame as ensureGameCategory } from "@/lib/admin/categories";
import { supabaseAdmin } from "@/lib/supabase";

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

    const categorySync = await ensureGameCategory(supabase, {
      id: game.id,
      slug: game.slug,
      name: game.name
    });

    const syncResult = await syncGameCodesFromSources(supabase, game.id, [
      game.source_url,
      game.source_url_2,
      game.source_url_3
    ]);

    revalidatePath("/admin/games");
    revalidatePath("/admin/article-categories");
    revalidatePath("/articles");
    const categorySlugs = new Set<string>();
    if (game.slug) {
      categorySlugs.add(game.slug);
    }
    if (categorySync.slug) {
      categorySlugs.add(categorySync.slug);
    }
    if (categorySync.previousSlug) {
      categorySlugs.add(categorySync.previousSlug);
    }
    for (const slug of categorySlugs) {
      revalidatePath(`/articles/category/${slug}`);
    }
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

export async function deleteGameById(id: string) {
  const { supabase } = await requireAdminAction();

  type GameSlugRow = { slug: string | null };
  const { data: gameRaw, error: gameError } = await supabase
    .from("games")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const game = gameRaw as GameSlugRow | null;

  if (gameError) {
    return { success: false, error: gameError.message };
  }

  if (!game) {
    return { success: false, error: "Game not found" };
  }

  type CategoryRow = { slug: string | null };
  const { data: categoryRowsRaw, error: categoryQueryError } = await supabase
    .from("article_categories")
    .select("slug")
    .eq("game_id", id);

  const categoryRows = categoryRowsRaw as CategoryRow[] | null;

  if (categoryQueryError) {
    return { success: false, error: categoryQueryError.message };
  }

  if ((categoryRows?.length ?? 0) > 0) {
    const { error: categoryDeleteError } = await supabase
      .from("article_categories")
      .delete()
      .eq("game_id", id);

    if (categoryDeleteError) {
      return { success: false, error: categoryDeleteError.message };
    }
  }

  const { error: gameDeleteError } = await supabase.from("games").delete().eq("id", id);

  if (gameDeleteError) {
    return { success: false, error: gameDeleteError.message };
  }

  revalidatePath("/admin/games");
  revalidatePath("/admin/article-categories");
  revalidatePath("/articles");

  const categorySlugs = new Set<string>();
  for (const row of categoryRows ?? []) {
    if (row?.slug) {
      categorySlugs.add(row.slug);
    }
  }

  if (game.slug) {
    categorySlugs.add(game.slug);
    revalidatePath(`/${game.slug}`);
  }

  for (const slug of categorySlugs) {
    revalidatePath(`/articles/category/${slug}`);
  }

  return { success: true };
}

export async function uploadGameImage(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file provided" };
  }

  const bucket = process.env.SUPABASE_MEDIA_BUCKET;
  if (!bucket) {
    return { success: false, error: "SUPABASE_MEDIA_BUCKET is not configured" };
  }

  const slugRaw = form.get("slug");
  const slug = typeof slugRaw === "string" ? slugRaw : "";
  const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "uploads";

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "File is too large. Maximum size is 10MB." };
  }

  const timestamp = Date.now();
  const originalName = file.name && file.name.trim().length ? file.name.trim() : `image-${timestamp}`;
  const sanitizedName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  const baseName = sanitizedName.replace(/\.[^.]+$/, "") || `image-${timestamp}`;

  let buffer = Buffer.from(await file.arrayBuffer());
  let finalExtension = (sanitizedName.includes(".") ? sanitizedName.split(".").pop() : "bin")!.toLowerCase();

  try {
    buffer = await sharp(buffer)
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    finalExtension = "webp";
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Image processing failed" };
  }

  const path = `games/${safeSlug}/${baseName}-${timestamp}.${finalExtension}`;

  const supabase = supabaseAdmin();

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: "image/webp",
    upsert: false
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { success: true, url: data.publicUrl };
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

  const refreshResult = await refreshGameCodesWithSupabase(supabase, game);

  if (!refreshResult.success) {
    return refreshResult;
  }

  revalidatePath("/admin/games");
  return {
    success: true,
    found: refreshResult.found,
    upserted: refreshResult.upserted,
    removed: refreshResult.removed
  };
}
