import type { Metadata } from "next";
import Link from "next/link";
import { signIn, signInWithGoogle, signOut, signUp } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

type AuthPageProps = {
  searchParams?: Promise<{ error?: string | string[]; success?: string | string[]; next?: string | string[] }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = Array.isArray(resolvedSearchParams?.error) ? resolvedSearchParams?.error[0] : resolvedSearchParams?.error ?? null;
  const successMessage = Array.isArray(resolvedSearchParams?.success) ? resolvedSearchParams?.success[0] : resolvedSearchParams?.success ?? null;
  const nextParam = Array.isArray(resolvedSearchParams?.next) ? resolvedSearchParams?.next[0] : resolvedSearchParams?.next ?? "";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2">
      <section className="panel space-y-5 p-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Welcome back</p>
          <h1 className="text-2xl font-semibold text-foreground">Sign in to your account</h1>
          <p className="text-sm text-muted">
            Access your saved progress and upcoming features.
          </p>
        </header>
        <form action={signInWithGoogle} className="space-y-4">
          {nextParam ? <input type="hidden" name="next" value={nextParam} /> : null}
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path
                fill="#EA4335"
                d="M12.23 10.41v3.9h5.54c-.23 1.49-1.7 4.37-5.54 4.37-3.34 0-6.07-2.76-6.07-6.18S8.89 6.32 12.23 6.32c1.9 0 3.18.81 3.91 1.51l2.66-2.55C17.13 3.7 14.92 2.7 12.23 2.7 6.95 2.7 2.7 6.98 2.7 12.5S6.95 22.3 12.23 22.3c6.52 0 7.93-4.55 7.93-6.93 0-.47-.05-.83-.12-1.18h-7.81z"
              />
              <path
                fill="#34A853"
                d="M3.83 7.38l3.22 2.36c.87-1.76 2.65-2.98 5.18-2.98 1.9 0 3.18.81 3.91 1.51l2.66-2.55C17.13 3.7 14.92 2.7 12.23 2.7 8.5 2.7 5.26 4.84 3.83 7.38z"
              />
              <path
                fill="#FBBC05"
                d="M12.23 22.3c2.63 0 4.84-.87 6.45-2.36l-3.08-2.38c-.82.55-1.93.93-3.37.93-3.82 0-5.28-2.86-5.49-4.36l-3.17 2.44c1.41 2.78 4.28 4.73 8.66 4.73z"
              />
              <path
                fill="#4285F4"
                d="M19.96 12.87c0-.47-.05-.83-.12-1.18h-7.61v3.9h5.54c-.26 1.49-1.73 4.37-5.54 4.37-3.34 0-6.07-2.76-6.07-6.18 0-.63.09-1.24.26-1.82L3.2 9.6A9.66 9.66 0 0 0 2.7 12.5c0 5.52 4.25 9.8 9.53 9.8 6.52 0 7.93-4.55 7.93-6.93z"
              />
            </svg>
            Continue with Google
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted">
          <span className="h-px flex-1 bg-border/60" />
          <span>or</span>
          <span className="h-px flex-1 bg-border/60" />
        </div>
        <form action={signIn} className="space-y-4">
          {nextParam ? <input type="hidden" name="next" value={nextParam} /> : null}
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Sign in
          </button>
        </form>
        <p className="text-xs text-muted">Email sign-ins require a verified address.</p>
        {errorMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}
      </section>

      <section className="panel space-y-5 p-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">New here?</p>
          <h2 className="text-2xl font-semibold text-foreground">Create your account</h2>
          <p className="text-sm text-muted">
            We&apos;ll create a user role automatically. Admin access is granted manually.
          </p>
        </header>
        <form action={signUp} className="space-y-4">
          {nextParam ? <input type="hidden" name="next" value={nextParam} /> : null}
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="At least 8 characters"
            />
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Create account
          </button>
        </form>
        <p className="text-xs text-muted">
          We&apos;ll email you a confirmation link and prompt you to link your Roblox account after sign-in.{" "}
          By creating an account, you agree to our{" "}
          <Link href="/privacy-policy" className="text-foreground transition hover:text-accent">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      {user ? (
        <section className="panel flex items-center justify-between gap-4 p-6 lg:col-span-2">
          <div className="space-y-1">
            <p className="text-sm text-muted">Signed in as</p>
            <p className="text-lg font-semibold text-foreground">{user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
