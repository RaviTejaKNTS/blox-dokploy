import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { AdminLoginForm } from "./LoginForm";

const supabaseEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
};

function sanitizeRedirect(input?: string | string[] | null): string {
  if (!input || Array.isArray(input)) return "/admin";
  if (!input.startsWith("/")) return "/admin";
  if (input.startsWith("//")) return "/admin";
  if (input.startsWith("/admin/login")) return "/admin";
  return input;
}

export const metadata = {
  title: "Admin Login"
};

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: { redirect?: string | string[]; error?: string | string[] };
}) {
  if (!supabaseEnv.supabaseUrl || !supabaseEnv.supabaseKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  const cookieStore = cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore
  }, {
    supabaseUrl: supabaseEnv.supabaseUrl,
    supabaseKey: supabaseEnv.supabaseKey
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const sanitizedRedirect = sanitizeRedirect(searchParams.redirect ?? null);
  const errorParam = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error;

  if (session) {
    const { data: adminRecord } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (adminRecord) {
      redirect(sanitizedRedirect || "/admin");
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <AdminLoginForm
          redirectTo={sanitizedRedirect}
          initialError={errorParam ?? null}
          unauthorized
          userEmail={session.user.email ?? undefined}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <AdminLoginForm redirectTo={sanitizedRedirect} initialError={errorParam ?? null} />
    </main>
  );
}
