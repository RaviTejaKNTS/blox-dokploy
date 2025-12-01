"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function HeaderControls() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = () => setOpen(false);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: "/articles", label: "Articles" },
    { href: "/codes", label: "Codes" },
    { href: "/lists", label: "Lists" },
    { href: "/tools/robux-to-usd-calculator", label: "Robux to USD" }
  ];

  const mobileMenu = (
    <div
      className="fixed inset-0 z-[100000] flex justify-end bg-black/60 backdrop-blur-sm md:hidden"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="flex h-full w-full max-w-sm flex-col gap-4 bg-surface px-5 py-6 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground">Menu</span>
          <button
            type="button"
            onClick={close}
            className="rounded border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded border border-border/60 bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              onClick={close}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          data-search-trigger
          onClick={close}
          className="inline-flex items-center gap-2 rounded border border-border/60 bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m21 21-4.35-4.35" />
            <circle cx="11" cy="11" r="6" />
          </svg>
          <span>Search</span>
        </button>

        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-3">
      {/* Desktop pills */}
      <div className="hidden md:flex flex-wrap items-center gap-3">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
          >
            <span className="hidden sm:inline">{link.label}</span>
            <span className="sm:hidden text-sm font-semibold">{link.label}</span>
          </Link>
        ))}
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

      {/* Mobile menu trigger */}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent md:hidden"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>

      {/* Mobile drawer */}
      {open && mounted ? createPortal(mobileMenu, document.body) : null}
    </div>
  );
}
