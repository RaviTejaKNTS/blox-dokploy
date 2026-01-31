"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/seo";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme";

const AUTH_PATH = "/login";
const DEFAULT_NEXT_PATH = "/account";
const ALLOWED_EMAIL = process.env.ALLOWED_SIGNIN_EMAIL?.trim().toLowerCase() || "";

async function getOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return SITE_URL;
}

function enforceAllowedEmail(email: string) {
  if (!ALLOWED_EMAIL) return true;
  return email.toLowerCase() === ALLOWED_EMAIL;
}

function sanitizeNextPath(rawNext: string | null) {
  if (!rawNext) return DEFAULT_NEXT_PATH;
  if (!rawNext.startsWith("/")) return DEFAULT_NEXT_PATH;
  if (rawNext.startsWith("//") || rawNext.includes("\\")) return DEFAULT_NEXT_PATH;
  if (rawNext.startsWith("/auth/") || rawNext.startsWith("/login")) return DEFAULT_NEXT_PATH;
  return rawNext;
}

function getNextPath(formData?: FormData) {
  if (!formData) return DEFAULT_NEXT_PATH;
  const rawNext = normalizeField(formData.get("next"));
  return sanitizeNextPath(rawNext || null);
}

function buildRedirect(status: "success" | "error", message: string, nextPath?: string) {
  const params = new URLSearchParams({ [status]: message });
  if (nextPath) {
    params.set("next", nextPath);
  }
  return `${AUTH_PATH}?${params.toString()}`;
}

function normalizeField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function signIn(formData: FormData) {
  const nextPath = getNextPath(formData);
  const email = normalizeField(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  if (!email || !password) {
    redirect(buildRedirect("error", "Please enter your email and password.", nextPath));
  }

  if (!enforceAllowedEmail(email)) {
    redirect(buildRedirect("error", "This email is not allowed to sign in.", nextPath));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(buildRedirect("error", error.message, nextPath));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildRedirect("error", "Unable to verify your session. Please try again.", nextPath));
  }

  const emailConfirmed = Boolean(user.email_confirmed_at ?? user.confirmed_at);
  if (!emailConfirmed) {
    await supabase.auth.signOut();
    redirect(buildRedirect("error", "Please verify your email before signing in.", nextPath));
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("email_login_enabled, preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  const emailLoginEnabled = appUser?.email_login_enabled === true;

  if (appUserError || !emailLoginEnabled) {
    await supabase.auth.signOut();
    redirect(
      buildRedirect(
        "error",
        appUserError
          ? "Unable to verify email login status."
          : "Email login is disabled for this account.",
        nextPath
      )
    );
  }

  const storedTheme = normalizeTheme((appUser?.preferences as Record<string, unknown> | null)?.theme as string | null);
  if (storedTheme) {
    const cookieStore = await cookies();
    cookieStore.set(THEME_COOKIE, storedTheme, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  redirect(nextPath);
}

export async function signUp(formData: FormData) {
  const nextPath = getNextPath(formData);
  const email = normalizeField(formData.get("email"));
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  if (!email || !password) {
    redirect(buildRedirect("error", "Please enter your email and password.", nextPath));
  }

  if (password.length < 8) {
    redirect(buildRedirect("error", "Password must be at least 8 characters.", nextPath));
  }

  if (!enforceAllowedEmail(email)) {
    redirect(buildRedirect("error", "This email is not allowed to create an account.", nextPath));
  }

  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(buildRedirect("error", error.message, nextPath));
  }

  if (data.session) {
    redirect(nextPath);
  }

  redirect(buildRedirect("success", "Check your email to confirm your account, then sign in.", nextPath));
}

export async function signInWithGoogle(formData: FormData) {
  const nextPath = getNextPath(formData);
  const origin = await getOrigin();
  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
  });

  if (error || !data.url) {
    redirect(buildRedirect("error", error?.message ?? "Unable to start Google sign-in.", nextPath));
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient({ allowSetCookies: true });
  await supabase.auth.signOut();
  redirect(buildRedirect("success", "Signed out."));
}
