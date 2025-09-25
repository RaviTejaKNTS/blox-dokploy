import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export const metadata = {
  title: "Admin Overview"
};

export default async function AdminHomePage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  return (
    <div className="min-h-[70vh] space-y-6">
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-border/60 bg-surface/80 p-8 shadow-soft">
        <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted">
          {session?.user.email ? `Signed in as ${session.user.email}` : "Signed in"}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
        >
          Return to site
        </Link>
      </div>
    </div>
  );
}
