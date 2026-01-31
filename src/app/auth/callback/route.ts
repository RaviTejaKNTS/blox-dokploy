import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme";

const ALLOWED_EMAIL = process.env.ALLOWED_SIGNIN_EMAIL?.trim().toLowerCase() || "";

function sanitizeNextPath(rawNext: string | null) {
  if (!rawNext) return "/login";
  if (!rawNext.startsWith("/")) return "/login";
  if (rawNext.startsWith("//") || rawNext.includes("\\")) return "/login";
  return rawNext;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");
  const sanitizedNext = sanitizeNextPath(rawNext);
  const next = sanitizedNext.startsWith("/auth/callback") ? "/account" : sanitizedNext;
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing auth code.")}`);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Supabase is not configured.")}`);
  }

  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach((cookie) => {
          cookiesToSet.push(cookie);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const email = data.user?.email?.toLowerCase() ?? "";
  if (ALLOWED_EMAIL && email !== ALLOWED_EMAIL) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("This email is not allowed to sign in.")}`);
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("preferences")
    .eq("user_id", data.user?.id ?? "")
    .maybeSingle();
  const storedTheme = normalizeTheme((appUser?.preferences as Record<string, unknown> | null)?.theme as string | null);

  const response = NextResponse.redirect(`${origin}${next}`);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  if (storedTheme) {
    response.cookies.set(THEME_COOKIE, storedTheme, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}
