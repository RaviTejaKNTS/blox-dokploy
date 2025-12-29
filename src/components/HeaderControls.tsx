"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FiCalendar, FiCheckSquare, FiFileText, FiGrid, FiKey, FiList, FiTool } from "react-icons/fi";
import { ThemeToggle } from "@/components/ThemeToggle";

export function HeaderControls() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = () => setOpen(false);
  const openSearch = () => {
    close();
    window.dispatchEvent(new Event("bloxodes:open-search"));
  };

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
    { href: "/articles", label: "Articles", icon: FiFileText },
    { href: "/codes", label: "Codes", icon: FiKey },
    { href: "/events", label: "Events", icon: FiCalendar },
    { href: "/catalog", label: "Catalog", icon: FiGrid },
    { href: "/checklists", label: "Checklists", icon: FiCheckSquare },
    { href: "/lists", label: "Lists", icon: FiList },
    { href: "/tools", label: "Tools", icon: FiTool }
  ];

  const mobileMenu = (
    <div
      className="fixed inset-0 z-[100000] flex justify-end bg-black/50 backdrop-blur-sm xl:hidden"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div className="fixed inset-x-0 top-0 z-10 pointer-events-none xl:hidden">
        <div className="container flex justify-end py-4">
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>
      </div>
      <div
        id="site-menu-panel"
        className="flex h-full w-full max-w-sm flex-col gap-6 border-l border-border/60 bg-surface/95 px-6 pb-7 pt-16 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">Menu</span>
          <p className="text-lg font-semibold text-foreground">Explore Bloxodes</p>
        </div>

        <nav className="flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              onClick={close}
            >
              <link.icon aria-hidden className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={openSearch}
          className="inline-flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
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
      <div className="hidden xl:flex flex-nowrap items-center gap-3">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
          >
            <link.icon aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">{link.label}</span>
            <span className="sm:hidden text-sm font-semibold">{link.label}</span>
          </Link>
        ))}
        <button
          type="button"
          data-search-trigger
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
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
        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent xl:hidden"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="site-menu-panel"
      >
        {open ? "Close" : "Menu"}
      </button>

      {/* Mobile drawer */}
      {open && mounted ? createPortal(mobileMenu, document.body) : null}
    </div>
  );
}
