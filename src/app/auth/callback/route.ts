import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({
    cookies
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

