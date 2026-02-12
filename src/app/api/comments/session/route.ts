import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: sessionUser.id,
        display_name: sessionUser.display_name,
        roblox_avatar_url: sessionUser.roblox_avatar_url,
        roblox_display_name: sessionUser.roblox_display_name,
        roblox_username: sessionUser.roblox_username,
        role: sessionUser.role
      }
    });
  } catch (error) {
    console.error("Failed to load comment session", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
