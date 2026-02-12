import "server-only";
import { getCurrentAppUser } from "@/lib/auth/app-session";

export type SessionUser = {
  id: string;
  role: "admin" | "user";
  display_name: string | null;
  roblox_user_id: number | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_profile_url: string | null;
};

function normalizeRole(value: unknown): "admin" | "user" {
  return value === "admin" ? "admin" : "user";
}

function normalizeRobloxUserId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return null;

  return {
    id: appUser.user_id,
    role: normalizeRole(appUser.role),
    display_name: appUser.display_name ?? null,
    roblox_user_id: normalizeRobloxUserId(appUser.roblox_user_id),
    roblox_username: appUser.roblox_username ?? null,
    roblox_display_name: appUser.roblox_display_name ?? null,
    roblox_avatar_url: appUser.roblox_avatar_url ?? null,
    roblox_profile_url: appUser.roblox_profile_url ?? null
  };
}
