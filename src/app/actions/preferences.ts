"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { THEME_COOKIE, type Theme, normalizeTheme } from "@/lib/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function mergePreferences(
  existing: Record<string, unknown> | null | undefined,
  updates: Record<string, unknown>
) {
  return { ...(existing ?? {}), ...updates };
}

export async function updateThemePreference(nextTheme: Theme) {
  const theme = normalizeTheme(nextTheme) ?? "dark";
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, { path: "/", maxAge: ONE_YEAR_SECONDS });

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { stored: false };
  }

  const { data: appUser, error: fetchError } = await supabase
    .from("app_users")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return { stored: false, error: fetchError.message };
  }

  const nextPreferences = mergePreferences(appUser?.preferences as Record<string, unknown> | null, {
    theme
  });

  const { error } = await supabase
    .from("app_users")
    .update({ preferences: nextPreferences })
    .eq("user_id", user.id);

  if (error) {
    return { stored: false, error: error.message };
  }

  return { stored: true };
}

export async function getThemePreference() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { theme: null };
  }

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { theme: null, error: error.message };
  }

  const storedTheme = normalizeTheme((appUser?.preferences as Record<string, unknown> | null)?.theme as string | null);

  if (storedTheme) {
    const cookieStore = await cookies();
    cookieStore.set(THEME_COOKIE, storedTheme, { path: "/", maxAge: ONE_YEAR_SECONDS });
  }

  return { theme: storedTheme ?? null };
}
