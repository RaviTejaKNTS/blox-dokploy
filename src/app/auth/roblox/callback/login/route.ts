import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/navigation";
import { createAppSession, clearAppSessionCookieOnResponse, setAppSessionCookieOnResponse } from "@/lib/auth/app-session";
import { supabaseAdmin } from "@/lib/supabase";
import {
  clearRobloxLoginOauthCookies,
  exchangeRobloxCodeForToken,
  fetchRobloxUserInfo,
  readRobloxLoginOauthCookies,
  resolveRobloxLoginRedirectUri
} from "@/lib/auth/roblox-login";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

const LOGIN_PATH = "/login";
const CALLBACK_RATE_LIMIT = {
  limit: 60,
  windowMs: 60 * 1000
};
const AUTH_ROBOTS_DIRECTIVE = "noindex, nofollow";

type AppUserRow = {
  user_id: string;
  display_name: string | null;
};

function buildLoginRedirect(origin: string, status: "success" | "error", message: string, nextPath?: string) {
  const params = new URLSearchParams({ [status]: message });
  if (nextPath) {
    params.set("next", sanitizeNextPath(nextPath));
  }
  return `${origin}${LOGIN_PATH}?${params.toString()}`;
}

function withNoIndexHeaders(response: NextResponse) {
  response.headers.set("X-Robots-Tag", AUTH_ROBOTS_DIRECTIVE);
  return response;
}

function attachCleanupCookies(response: NextResponse): NextResponse {
  clearRobloxLoginOauthCookies(response);
  clearAppSessionCookieOnResponse(response);
  return withNoIndexHeaders(response);
}

function normalizeRobloxName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toRobloxUserId(value: string | null | undefined): number | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const ip = getRequestIp(request);
  const rateLimit = checkRateLimit({
    key: `roblox-callback:${ip}`,
    ...CALLBACK_RATE_LIMIT
  });
  const oauthCookies = readRobloxLoginOauthCookies(request);
  const nextPath = sanitizeNextPath(oauthCookies.nextPath);
  const redirectUri = resolveRobloxLoginRedirectUri(origin);

  const redirectWithError = (message: string) =>
    attachCleanupCookies(NextResponse.redirect(buildLoginRedirect(origin, "error", message, nextPath)));

  if (!rateLimit.allowed) {
    const response = redirectWithError("Too many login attempts. Please try again shortly.");
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  if (oauthError) {
    return redirectWithError("Roblox sign-in was canceled or failed.");
  }

  if (!code) {
    return redirectWithError("Missing Roblox auth code.");
  }

  if (!state || !oauthCookies.state || state !== oauthCookies.state) {
    return redirectWithError("Invalid Roblox OAuth state.");
  }

  if (!oauthCookies.verifier) {
    return redirectWithError("Missing Roblox verifier.");
  }

  const clientId = process.env.ROBLOX_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ROBLOX_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectWithError("Roblox OAuth is not configured.");
  }

  const tokenResult = await exchangeRobloxCodeForToken({
    clientId,
    clientSecret,
    code,
    verifier: oauthCookies.verifier,
    redirectUri
  });

  if (!tokenResult.accessToken) {
    return redirectWithError(tokenResult.errorMessage ?? "Roblox token exchange failed.");
  }

  const userInfoResult = await fetchRobloxUserInfo(tokenResult.accessToken);
  if (!userInfoResult.userInfo) {
    return redirectWithError(userInfoResult.errorMessage ?? "Unable to fetch Roblox profile.");
  }

  const robloxUserId = toRobloxUserId(userInfoResult.userInfo.sub);
  if (!robloxUserId) {
    return redirectWithError("Roblox profile is missing a valid id.");
  }

  const robloxUsername = normalizeRobloxName(userInfoResult.userInfo.preferred_username);
  const robloxDisplayName = normalizeRobloxName(userInfoResult.userInfo.name ?? userInfoResult.userInfo.nickname);
  const profileUrl = normalizeRobloxName(userInfoResult.userInfo.profile) ?? `https://www.roblox.com/users/${robloxUserId}/profile`;
  const avatarUrl = normalizeRobloxName(userInfoResult.userInfo.picture);
  const defaultDisplayName = robloxDisplayName ?? robloxUsername ?? `Roblox User ${robloxUserId}`;

  const supabase = supabaseAdmin();
  const { data: existingUser, error: existingUserError } = await supabase
    .from("app_users")
    .select("user_id, display_name")
    .eq("roblox_user_id", robloxUserId)
    .maybeSingle<AppUserRow>();

  if (existingUserError) {
    return redirectWithError("Unable to look up user profile.");
  }

  const nowIso = new Date().toISOString();
  let userId = existingUser?.user_id ?? crypto.randomUUID();

  if (existingUser) {
    const finalDisplayName = normalizeRobloxName(existingUser.display_name) ?? defaultDisplayName;
    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        display_name: finalDisplayName,
        roblox_user_id: robloxUserId,
        roblox_username: robloxUsername,
        roblox_display_name: robloxDisplayName,
        roblox_profile_url: profileUrl,
        roblox_avatar_url: avatarUrl,
        roblox_linked_at: nowIso
      })
      .eq("user_id", userId);

    if (updateError) {
      return redirectWithError("Failed to update Roblox profile.");
    }
  } else {
    const { data: insertedUser, error: insertError } = await supabase
      .from("app_users")
      .insert({
        user_id: userId,
        role: "user",
        display_name: defaultDisplayName,
        roblox_user_id: robloxUserId,
        roblox_username: robloxUsername,
        roblox_display_name: robloxDisplayName,
        roblox_profile_url: profileUrl,
        roblox_avatar_url: avatarUrl,
        roblox_linked_at: nowIso
      })
      .select("user_id")
      .single<{ user_id: string }>();

    if (insertError || !insertedUser) {
      const { data: racedUser } = await supabase
        .from("app_users")
        .select("user_id")
        .eq("roblox_user_id", robloxUserId)
        .maybeSingle<{ user_id: string }>();
      if (!racedUser?.user_id) {
        return redirectWithError("Failed to create user profile.");
      }
      userId = racedUser.user_id;
    } else {
      userId = insertedUser.user_id;
    }
  }

  let sessionToken: string;
  let sessionMaxAge: number;
  try {
    const session = await createAppSession(userId, request.headers.get("user-agent"));
    sessionToken = session.token;
    sessionMaxAge = session.maxAge;
  } catch {
    return redirectWithError("Failed to create login session.");
  }

  const response = NextResponse.redirect(`${origin}${nextPath}`);
  clearRobloxLoginOauthCookies(response);
  setAppSessionCookieOnResponse(response, sessionToken, sessionMaxAge);
  return withNoIndexHeaders(response);
}
