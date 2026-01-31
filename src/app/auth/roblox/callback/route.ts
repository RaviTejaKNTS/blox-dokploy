import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const ROBLOX_TOKEN_URL = "https://apis.roblox.com/oauth/v1/token";
const ROBLOX_USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo";
const STATE_COOKIE = "roblox_oauth_state";
const VERIFIER_COOKIE = "roblox_oauth_verifier";
const USER_COOKIE = "roblox_oauth_user";
const REDIRECT_PATH = "/account";

function buildRedirect(origin: string, status: "success" | "error", message: string) {
  const params = new URLSearchParams({ [status]: message });
  return `${origin}${REDIRECT_PATH}?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Missing Roblox auth code."));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value ?? null;
  const verifier = cookieStore.get(VERIFIER_COOKIE)?.value ?? null;
  const signedUser = cookieStore.get(USER_COOKIE)?.value ?? null;
  cookieStore.set({
    name: STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0
  });
  cookieStore.set({
    name: VERIFIER_COOKIE,
    value: "",
    path: "/",
    maxAge: 0
  });
  cookieStore.set({
    name: USER_COOKIE,
    value: "",
    path: "/",
    maxAge: 0
  });

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Invalid Roblox OAuth state."));
  }

  if (!verifier) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Missing Roblox verifier."));
  }

  const clientId = process.env.ROBLOX_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ROBLOX_OAUTH_CLIENT_SECRET?.trim();
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!clientId || !clientSecret || !supabaseServiceRole || !supabaseUrl) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Roblox OAuth is not configured."));
  }

  if (!signedUser) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Missing Roblox linking session."));
  }
  const [userId, signature] = signedUser.split(".");
  if (!userId || !signature) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Invalid Roblox linking session."));
  }
  const expectedSignature = crypto.createHmac("sha256", clientSecret).update(userId).digest();
  const providedSignature = Buffer.from(signature, "hex");
  if (expectedSignature.length !== providedSignature.length || !crypto.timingSafeEqual(expectedSignature, providedSignature)) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Invalid Roblox linking session."));
  }

  const restHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseServiceRole}`,
    apikey: supabaseServiceRole
  };

  const redirectUri = `${origin}/auth/roblox/callback`;
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch(ROBLOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: tokenBody.toString()
  });

  const tokenData = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenData?.access_token) {
    const message = tokenData?.error_description || tokenData?.error || "Roblox token exchange failed.";
    return NextResponse.redirect(buildRedirect(origin, "error", message));
  }

  const userInfoRes = await fetch(ROBLOX_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  const userInfo = await userInfoRes.json().catch(() => null);
  if (!userInfoRes.ok || !userInfo?.sub) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Unable to fetch Roblox profile."));
  }

  const robloxUserId = typeof userInfo.sub === "string" ? userInfo.sub : null;
  if (!robloxUserId) {
    return NextResponse.redirect(buildRedirect(origin, "error", "Roblox profile is missing an id."));
  }
  const robloxUsername = userInfo.preferred_username ?? null;
  const robloxDisplayName = userInfo.name ?? userInfo.nickname ?? null;
  const profileUrl = userInfo.profile ?? null;
  const avatarUrl = userInfo.picture ?? null;

  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/app_users?select=user_id&roblox_user_id=eq.${encodeURIComponent(robloxUserId)}&limit=1`,
    { headers: restHeaders, cache: "no-store", credentials: "omit" }
  );
  if (!existingRes.ok) {
    const errorBody = await existingRes.text().catch(() => "");
    const message =
      errorBody.trim() ||
      `Unable to verify Roblox link status (status ${existingRes.status}).`;
    return NextResponse.redirect(buildRedirect(origin, "error", message));
  }
  const existingRows = (await existingRes.json().catch(() => [])) as Array<{ user_id?: string }>;
  if (existingRows?.[0]?.user_id && existingRows[0].user_id !== userId) {
    return NextResponse.redirect(buildRedirect(origin, "error", "This Roblox account is already linked."));
  }

  const updateRes = await fetch(`${supabaseUrl}/rest/v1/app_users?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: {
      ...restHeaders,
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      roblox_user_id: Number(robloxUserId),
      roblox_username: robloxUsername,
      roblox_display_name: robloxDisplayName,
      roblox_profile_url: profileUrl,
      roblox_avatar_url: avatarUrl,
      roblox_linked_at: new Date().toISOString()
    }),
    cache: "no-store",
    credentials: "omit"
  });

  if (!updateRes.ok) {
    const errorBody = await updateRes.text().catch(() => "");
    return NextResponse.redirect(buildRedirect(origin, "error", errorBody || "Failed to link Roblox account."));
  }

  return NextResponse.redirect(buildRedirect(origin, "success", "Roblox account linked."));
}
