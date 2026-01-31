"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/seo";

const ACCOUNT_PATH = "/account";
const ROBLOX_AUTHORIZE_URL = "https://apis.roblox.com/oauth/v1/authorize";
const ROBLOX_STATE_COOKIE = "roblox_oauth_state";
const ROBLOX_VERIFIER_COOKIE = "roblox_oauth_verifier";
const ROBLOX_OAUTH_SCOPE = "openid profile";
const ROBLOX_USER_COOKIE = "roblox_oauth_user";
const ROBLOX_COOKIE_MAX_AGE = 60 * 10; // 10 minutes

function buildRedirect(status: "success" | "error", message: string) {
  const params = new URLSearchParams({ [status]: message });
  return `${ACCOUNT_PATH}?${params.toString()}`;
}

async function getOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return SITE_URL;
}

function normalizeField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toBase64Url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return toBase64Url(crypto.randomBytes(32));
}

function createCodeChallenge(verifier: string) {
  return toBase64Url(crypto.createHash("sha256").update(verifier).digest());
}

function signRobloxUser(userId: string, secret: string) {
  const signature = crypto.createHmac("sha256", secret).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export async function linkGoogle() {
  const origin = await getOrigin();
  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { data: identitiesData } = await supabase.auth.getUserIdentities();
  const identities = identitiesData?.identities ?? [];
  const providers = new Set(identities.map((identity) => identity.provider));
  if (providers.has("google")) {
    redirect(buildRedirect("success", "Google is already linked."));
  }
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(ACCOUNT_PATH)}`
    }
  });

  if (error || !data?.url) {
    const message =
      error?.message === "Manual linking is disabled"
        ? "Enable manual linking in Supabase Auth settings to link providers."
        : error?.message ?? "Unable to start Google linking.";
    redirect(buildRedirect("error", message));
  }

  redirect(data.url);
}

export async function linkRoblox() {
  const clientId = process.env.ROBLOX_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ROBLOX_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    redirect(buildRedirect("error", "Roblox OAuth is not configured."));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "You must be signed in."));
  }

  const { data: existingLink } = await supabase
    .from("app_users")
    .select("roblox_user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingLink?.roblox_user_id) {
    redirect(buildRedirect("success", "Roblox is already linked."));
  }

  const origin = await getOrigin();
  const state = toBase64Url(crypto.randomBytes(16));
  const verifier = createCodeVerifier();
  const challenge = createCodeChallenge(verifier);

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ROBLOX_COOKIE_MAX_AGE
  };

  cookieStore.set(ROBLOX_STATE_COOKIE, state, cookieOptions);
  cookieStore.set(ROBLOX_VERIFIER_COOKIE, verifier, cookieOptions);
  cookieStore.set(ROBLOX_USER_COOKIE, signRobloxUser(user.id, clientSecret), cookieOptions);

  const redirectUri = `${origin}/auth/roblox/callback`;
  const url = new URL(ROBLOX_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ROBLOX_OAUTH_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  redirect(url.toString());
}

export async function unlinkRoblox() {
  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "You must be signed in."));
  }

  const { error } = await supabase
    .from("app_users")
    .update({
      roblox_user_id: null,
      roblox_username: null,
      roblox_display_name: null,
      roblox_profile_url: null,
      roblox_avatar_url: null,
      roblox_linked_at: null
    })
    .eq("user_id", user.id);
  if (error) {
    redirect(buildRedirect("error", error.message));
  }

  redirect(buildRedirect("success", "Roblox account unlinked."));
}

export async function enableEmailLogin(formData: FormData) {
  const password = normalizeField(formData.get("password"));
  const confirmPassword = normalizeField(formData.get("confirmPassword"));

  if (!password) {
    redirect(buildRedirect("error", "Please enter a password."));
  }

  if (password.length < 8) {
    redirect(buildRedirect("error", "Password must be at least 8 characters."));
  }

  if (password !== confirmPassword) {
    redirect(buildRedirect("error", "Passwords do not match."));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "You must be signed in."));
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(buildRedirect("error", error.message));
  }

  const { error: updateError } = await supabase
    .from("app_users")
    .update({ email_login_enabled: true })
    .eq("user_id", user.id);

  if (updateError) {
    redirect(buildRedirect("error", updateError.message));
  }

  redirect(buildRedirect("success", "Email login enabled."));
}

export async function unlinkIdentity(formData: FormData) {
  const identityId = normalizeField(formData.get("identityId"));
  if (!identityId) {
    redirect(buildRedirect("error", "Missing identity to unlink."));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();

  if (identitiesError) {
    redirect(buildRedirect("error", identitiesError.message));
  }

  const identities = identitiesData?.identities ?? [];
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const identity = identities.find((entry) => entry.id === identityId);
  if (!identity) {
    redirect(buildRedirect("error", "Sign-in method not found."));
  }
  if (identity.provider === "email") {
    redirect(buildRedirect("error", "Email login can only be disabled, not unlinked."));
  }
  const remainingIdentities = identities.filter((entry) => entry.id !== identity.id);
  if (remainingIdentities.length === 0) {
    redirect(buildRedirect("error", "You must keep at least one linked provider."));
  }

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) {
    redirect(buildRedirect("error", error.message));
  }

  redirect(buildRedirect("success", "Sign-in method unlinked."));
}

export async function disableEmailLogin() {
  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();

  if (identitiesError) {
    redirect(buildRedirect("error", identitiesError.message));
  }

  const identities = identitiesData?.identities ?? [];
  const nonEmailIdentities = identities.filter((entry) => entry.provider !== "email");
  if (nonEmailIdentities.length === 0) {
    redirect(buildRedirect("error", "You must keep at least one sign-in method."));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "You must be signed in."));
  }

  const { error } = await supabase.from("app_users").update({ email_login_enabled: false }).eq("user_id", user.id);
  if (error) {
    redirect(buildRedirect("error", error.message));
  }
  redirect(buildRedirect("success", "Email login disabled."));
}

export async function updateDisplayName(formData: FormData) {
  const displayName = normalizeField(formData.get("displayName"));

  if (!displayName) {
    redirect(buildRedirect("error", "Please enter a name."));
  }

  if (displayName.length < 2 || displayName.length > 50) {
    redirect(buildRedirect("error", "Name must be between 2 and 50 characters."));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "You must be signed in."));
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: displayName,
      full_name: displayName
    }
  });

  if (error) {
    redirect(buildRedirect("error", error.message));
  }

  const { error: profileError } = await supabase
    .from("app_users")
    .update({ display_name: displayName })
    .eq("user_id", user.id);

  if (profileError) {
    redirect(buildRedirect("error", profileError.message));
  }

  redirect(buildRedirect("success", "Name updated."));
}
