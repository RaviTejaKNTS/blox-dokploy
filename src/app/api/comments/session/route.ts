import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    const { data: appUser } = await supabase
      .from("app_users")
      .select("display_name, roblox_avatar_url, roblox_display_name, roblox_username, role")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        display_name: appUser?.display_name ?? null,
        roblox_avatar_url: appUser?.roblox_avatar_url ?? null,
        roblox_display_name: appUser?.roblox_display_name ?? null,
        roblox_username: appUser?.roblox_username ?? null,
        role: appUser?.role ?? "user"
      }
    });
  } catch (error) {
    console.error("Failed to load comment session", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
