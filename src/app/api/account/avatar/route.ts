import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();

  const headers = {
    "Cache-Control": "private, no-store, max-age=0"
  };

  if (!user) {
    return NextResponse.json({ avatarUrl: null, displayName: null }, { headers });
  }

  const displayName = user.roblox_display_name ?? user.roblox_username ?? null;

  return NextResponse.json(
    {
      avatarUrl: user.roblox_avatar_url ?? null,
      displayName
    },
    { headers }
  );
}
