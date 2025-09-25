import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const supabaseEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
};

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

  if (!supabaseEnv.supabaseUrl || !supabaseEnv.supabaseKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res }, {
    supabaseUrl: supabaseEnv.supabaseUrl,
    supabaseKey: supabaseEnv.supabaseKey
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
