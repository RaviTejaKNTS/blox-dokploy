"use client";

import { useEffect } from "react";

type EzoicAdSlotProps = {
  placeholderId: number;
};

type EzStandalone = {
  cmd?: Array<() => void>;
  showAds?: (...ids: number[]) => void;
};

declare global {
  interface Window {
    ezstandalone?: EzStandalone;
  }
}

export function EzoicAdSlot({ placeholderId }: EzoicAdSlotProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ez = window.ezstandalone ?? (window.ezstandalone = {});
    ez.cmd = Array.isArray(ez.cmd) ? ez.cmd : [];

    const showAd = () => {
      if (typeof ez.showAds === "function") {
        ez.showAds(placeholderId);
      }
    };

    ez.cmd.push(showAd);

    // If the library has already loaded, render immediately.
    showAd();
  }, [placeholderId]);

  return <div id={`ezoic-pub-ad-placeholder-${placeholderId}`} />;
}
