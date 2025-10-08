import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase-config";

function sanitizeRedirectPath(value?: string | null) {
  if (!value) return "/admin";
  if (!value.startsWith("/")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  const { supabaseUrl, supabaseKey, cookieOptions } = getSupabaseConfig();
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res }, {
    supabaseUrl,
    supabaseKey,
    cookieOptions
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const redirectParam = req.nextUrl.searchParams.get("redirect");
  const sanitizedRedirect = sanitizeRedirectPath(redirectParam ?? null);

  if (pathname === "/admin/login") {
    if (!session) {
      return res;
    }

    const { data: adminRecord } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminRecord) {
      const target = new URL(sanitizedRedirect || "/admin", req.url);
      return NextResponse.redirect(target);
    }

    return res;
  }

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { data: adminRecord, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !adminRecord) {
    await supabase.auth.signOut();
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"]
};
