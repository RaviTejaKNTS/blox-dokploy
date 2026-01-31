import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type SupabaseServerClientOptions = {
  allowSetCookies?: boolean;
};

export async function createSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase server client requires SUPABASE_URL and SUPABASE_ANON_KEY");
  }

  const cookieStore = await cookies();
  const allowSetCookies = options.allowSetCookies === true;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!allowSetCookies) return;
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
        });
      }
    }
  });
}
