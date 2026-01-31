import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const headers = {
    "Cache-Control": "private, no-store, max-age=0"
  };

  if (!user) {
    return NextResponse.json({ avatarUrl: null, displayName: null }, { headers });
  }

  const { data } = await supabase
    .from("app_users")
    .select("roblox_avatar_url, roblox_display_name, roblox_username")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = data?.roblox_display_name ?? data?.roblox_username ?? null;

  return NextResponse.json(
    {
      avatarUrl: data?.roblox_avatar_url ?? null,
      displayName
    },
    { headers }
  );
}
