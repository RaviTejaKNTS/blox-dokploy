import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return NextResponse.json(
      { userId: user?.id ?? null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load quiz session", error);
    return NextResponse.json(
      { userId: null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}
