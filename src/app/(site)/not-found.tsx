import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

export default function SiteNotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
      <div className="space-y-4">
        <span className="inline-flex rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
          404 — Page Not Found
        </span>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          We couldn&apos;t find the page you were looking for.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted md:text-lg">
          The link may be outdated, or the page might have moved. Explore the latest Roblox code drops, curated game lists, and in-depth articles, or head back to the {SITE_NAME} home page.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-border/60 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Go home
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/codes"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            See Roblox codes
          </Link>
          <Link
            href="/lists"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Browse game lists
          </Link>
          <Link
            href="/articles"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Read latest articles
          </Link>
        </nav>
      </div>
    </section>
  );
}
