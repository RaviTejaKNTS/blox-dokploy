import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase-config";

export async function POST(request: Request) {
  const { supabaseUrl, supabaseKey, cookieOptions } = getSupabaseConfig();

  const supabase = createRouteHandlerClient({
    cookies
  }, {
    supabaseUrl,
    supabaseKey,
    cookieOptions
  });

  const { event, session } = await request.json();

  if (event === "SIGNED_OUT") {
    await supabase.auth.signOut();
    return NextResponse.json({ status: "signed_out" });
  }

  if (session) {
    await supabase.auth.setSession(session);
  }

  return NextResponse.json({ status: "ok" });
}
