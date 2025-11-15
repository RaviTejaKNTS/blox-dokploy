import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/95 backdrop-blur">
        <div className="container flex flex-wrap items-center justify-between gap-6 py-4">
          <div className="flex flex-1 flex-wrap items-end gap-10">
            <a href="/" className="flex items-end gap-3">
              <Image
                src="/Bloxodes-dark.png"
                alt="Bloxodes"
                width={948}
                height={319}
                priority
                className="hidden h-9 w-auto dark:block"
              />
              <Image
                src="/Bloxodes-light.png"
                alt="Bloxodes"
                width={948}
                height={319}
                loading="lazy"
                fetchPriority="low"
                className="block h-9 w-auto dark:hidden"
              />
            </a>
            <nav className="flex items-center gap-6 text-sm font-semibold text-muted">
              <Link href="/articles" className="transition hover:text-foreground">
                Articles
              </Link>
              <Link href="/codes" className="transition hover:text-foreground">
                Codes
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-search-trigger
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
            >
              <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="6" />
              </svg>
              <span className="hidden sm:inline">Search</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container flex-1 py-10">{children}</main>
      <footer className="mt-16 border-t border-border/60">
        <div className="container flex flex-col gap-6 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex items-center gap-3 text-foreground">
            <div className="relative h-8 w-auto">
              <Image
                src="/Bloxodes-dark.png"
                alt="Bloxodes"
                width={948}
                height={319}
                loading="lazy"
                fetchPriority="low"
                className="hidden h-8 w-auto dark:block"
              />
              <Image
                src="/Bloxodes-light.png"
                alt="Bloxodes"
                width={948}
                height={319}
                loading="lazy"
                fetchPriority="low"
                className="block h-8 w-auto dark:hidden"
              />
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-xs uppercase tracking-wide text-muted md:text-sm">
            <Link href="/about" className="transition hover:text-foreground">
              About Us
            </Link>
            <Link href="/how-we-gather-and-verify-codes" className="transition hover:text-foreground">
              How We Verify Codes
            </Link>
            <Link href="/contact" className="transition hover:text-foreground">
              Contact Us
            </Link>
            <Link href="/editorial-guidelines" className="transition hover:text-foreground">
              Editorial Guidelines
            </Link>
            <Link href="/privacy-policy" className="transition hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/disclaimer" className="transition hover:text-foreground">
              Disclaimer
            </Link>
          </nav>
          <div className="text-xs text-muted md:text-right">
            <p>© {currentYear} Bloxodes. Not affiliated with Roblox.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
