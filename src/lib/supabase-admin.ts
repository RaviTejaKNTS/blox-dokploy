import { supabaseAdmin as createSupabaseAdmin } from "@/lib/supabase";

export function supabaseAdmin() {
  return createSupabaseAdmin();
}
