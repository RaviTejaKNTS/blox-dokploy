"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAdminSession } from "@/hooks/use-admin-session";

const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/article-categories", label: "Categories" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/media", label: "Media" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const { session, role, loading } = useAdminSession();
  const email = session?.user.email ?? "";
  const roleResolved = role !== undefined;
  const displayEmail = email || "Unknown";
  const showLoading = loading && !session;
  const fullWidthLayout = pathname?.startsWith("/admin/articles/write");

  useEffect(() => {
    if (loading || !roleResolved) return;
    if (!session || role === null) {
      const search = new URLSearchParams({ redirect: pathname || "/admin" });
      router.replace(`/admin/login?${search.toString()}`);
    }
  }, [loading, roleResolved, session, role, router, pathname]);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      try {
        await fetch("/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ event, session: nextSession })
        });
      } catch (error) {
        console.error("Failed to sync Supabase auth session", error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
      router.push("/admin/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-lg font-semibold text-foreground">
              Admin Panel
            </Link>
            <nav className="hidden items-center gap-3 text-sm text-muted md:flex">
              {adminNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-full px-3 py-1 transition",
                    pathname === item.href ? "bg-foreground text-background" : "hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted md:text-sm">
            <div className="hidden flex-col md:flex">
              <span className="font-semibold text-foreground">
                {showLoading ? "Loading…" : displayEmail}
              </span>
              <span className="uppercase tracking-wide">{roleResolved ? role ?? "" : ""}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border border-border/60 px-4 py-1 text-sm font-medium text-foreground transition hover:border-foreground/80 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-border/60 px-4 py-2 text-xs text-muted md:hidden">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "rounded-full px-3 py-1",
                pathname === item.href ? "bg-foreground text-background" : "bg-surface-muted text-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main
        className={clsx(
          "mx-auto flex min-h-[calc(100vh-80px)] w-full flex-col gap-8 px-6 py-10",
          fullWidthLayout ? "max-w-none" : "max-w-6xl"
        )}
      >
        {children}
      </main>
    </div>
  );
}
