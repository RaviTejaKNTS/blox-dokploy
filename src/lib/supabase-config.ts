import type { CookieOptionsWithName } from "@supabase/auth-helpers-shared";

export function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  const cookieOptions: CookieOptionsWithName = {
    domain: undefined,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  };

  return {
    supabaseUrl,
    supabaseKey,
    cookieOptions
  };
}
