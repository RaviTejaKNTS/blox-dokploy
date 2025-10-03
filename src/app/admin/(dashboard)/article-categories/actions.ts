"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/admin-auth";
import { slugify } from "@/lib/slug";

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional()
});

function formDataToObject(form: FormData) {
  return Object.fromEntries(form as unknown as Iterable<[string, FormDataEntryValue]>);
}

export async function saveArticleCategory(formData: FormData) {
  const raw = formDataToObject(formData);

  const payload = categorySchema.parse({
    id: raw.id ? String(raw.id) : undefined,
    name: String(raw.name ?? ""),
    slug: (raw.slug ? String(raw.slug) : slugify(String(raw.name ?? ""))) || slugify("category"),
    description: raw.description ? String(raw.description) : null
  });

  const normalizedSlug = slugify(payload.slug);
  const record = {
    name: payload.name.trim(),
    slug: normalizedSlug,
    description: payload.description
  };

  const { supabase } = await requireAdminAction();

  if (payload.id) {
    const { error } = await supabase
      .from("article_categories")
      .update(record)
      .eq("id", payload.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("article_categories").insert(record);
    if (error) throw error;
  }

  revalidatePath("/admin/article-categories");
  revalidatePath("/articles");
  revalidatePath(`/articles/category/${normalizedSlug}`);

  return { success: true };
}

export async function deleteArticleCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { success: false, error: "Missing category id" };
  }

  const { supabase } = await requireAdminAction();
  const { data, error } = await supabase
    .from("article_categories")
    .delete()
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) throw error;

  revalidatePath("/admin/article-categories");
  revalidatePath("/articles");
  if (data?.slug) {
    revalidatePath(`/articles/category/${data.slug}`);
  }

  return { success: true };
}
