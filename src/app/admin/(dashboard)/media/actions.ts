"use server";

import { Buffer } from "node:buffer";
import { requireAdminAction } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_MEDIA_BUCKET;

function ensureBucket() {
  if (!BUCKET) {
    throw new Error("SUPABASE_MEDIA_BUCKET is not configured");
  }
  return BUCKET;
}

function normalizePath(path: string | null | undefined) {
  if (!path) return "";
  return path.replace(/^\/+|\/+$/g, "");
}

function mapStorageListing(path: string, items: any[], supabase: SupabaseClient) {
  const normalized = normalizePath(path);
  const folders: { name: string; path: string }[] = [];
  const files: { name: string; path: string; size: number; updated_at: string | null; public_url: string }[] = [];

  for (const item of items ?? []) {
    const entryPath = normalized ? `${normalized}/${item.name}` : item.name;
    const isFolder = !item.metadata;
    if (isFolder) {
      folders.push({ name: item.name, path: entryPath });
      continue;
    }
    const { data: publicData } = supabase.storage.from(ensureBucket()).getPublicUrl(entryPath);
    const publicUrl = publicData?.publicUrl ?? "";
    files.push({
      name: item.name,
      path: entryPath,
      size: item.metadata?.size ?? 0,
      updated_at: item.updated_at ?? item.created_at ?? null,
      public_url: publicUrl
    });
  }

  return { path: normalized, folders, files };
}

export async function listMediaEntries(path: string) {
  const bucket = ensureBucket();
  await requireAdminAction();
  const supabase = supabaseAdmin();
  const normalized = normalizePath(path);
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(normalized || "", {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" }
    });

  if (error) {
    throw new Error(error.message);
  }

  return mapStorageListing(normalized, data, supabase);
}

export async function uploadMedia(formData: FormData) {
  const bucket = ensureBucket();
  await requireAdminAction();
  const supabase = supabaseAdmin();
  const file = formData.get("file");
  const path = normalizePath(formData.get("path") as string | null | undefined);

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file provided" };
  }

  const arrayBuffer = await file.arrayBuffer();
  const timestamp = Date.now();
  const originalName = file.name && file.name.trim().length ? file.name.trim() : `upload-${timestamp}`;
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  const relativePath = path ? `${path}/${sanitizedName}` : sanitizedName;

  const { error } = await supabase.storage.from(bucket).upload(relativePath, Buffer.from(arrayBuffer), {
    upsert: true,
    contentType: file.type || undefined
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteMediaObject(path: string) {
  const bucket = ensureBucket();
  await requireAdminAction();
  const supabase = supabaseAdmin();
  const normalized = normalizePath(path);
  if (!normalized) {
    return { success: false, error: "Missing path" };
  }

  const { error } = await supabase.storage.from(bucket).remove([normalized]);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
