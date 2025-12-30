"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function shouldShowFooter() {
  if (typeof window === "undefined") return false;
  return window.innerWidth > 900 && window.innerHeight <= window.innerWidth;
}

export function ChecklistFooterLinks() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => setVisible(shouldShowFooter());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 right-3 z-30 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-[11px] text-muted shadow-lg backdrop-blur">
      <span>© 2025 Bloxodes</span>
      <span aria-hidden="true">•</span>
      <Link href="/privacy-policy" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
        Privacy
      </Link>
      <span aria-hidden="true">•</span>
      <Link href="/about" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
        About
      </Link>
      <span aria-hidden="true">•</span>
      <Link href="/contact" className="text-foreground hover:text-accent underline-offset-4 hover:underline">
        Contact
      </Link>
    </div>
  );
}
