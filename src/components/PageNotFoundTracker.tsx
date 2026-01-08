"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function PageNotFoundTracker() {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    trackEvent("page_not_found", {
      requested_path: path,
      referrer: document.referrer || ""
    });
  }, []);

  return null;
}
