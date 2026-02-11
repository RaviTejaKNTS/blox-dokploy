"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConsent } from "@/components/consent/ConsentProvider";

type AdStatus = "unknown" | "filled" | "unfilled";

type ContentSlotProps = {
  slot: string;
  clientId?: string;
  className?: string;
  minHeight?: number | string;
  rootMargin?: string;
  adLayout?: string | null;
  adLayoutKey?: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  textAlign?: "left" | "center" | "right" | "start" | "end";
  collapseOnUnfilled?: boolean;
  collapseAfterMs?: number;
};

const DEFAULT_MIN_HEIGHT = 250;
const DEFAULT_ROOT_MARGIN = "600px 0px";

export function ContentSlot({
  slot,
  clientId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID ?? "ca-pub-5243258773824278",
  className,
  minHeight = DEFAULT_MIN_HEIGHT,
  rootMargin = DEFAULT_ROOT_MARGIN,
  adLayout = "in-article",
  adLayoutKey,
  adFormat = "fluid",
  fullWidthResponsive = false,
  textAlign = "center",
  collapseOnUnfilled = false,
  collapseAfterMs = 0
}: ContentSlotProps) {
  const { requiresConsent, state, shouldShowBanner } = useConsent();
  const [isMounted, setIsMounted] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [status, setStatus] = useState<AdStatus>("unknown");
  const insRef = useRef<HTMLModElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPushedRef = useRef(false);
  const unfilledTimeoutRef = useRef<number | null>(null);

  const marketingAllowed = useMemo(() => {
    if (!requiresConsent) return true;
    if (shouldShowBanner) return false;
    return state.marketing;
  }, [requiresConsent, shouldShowBanner, state.marketing]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const container = containerRef.current;
    if (!container || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isMounted, isInView, rootMargin]);

  const shouldCollapse = collapseOnUnfilled && status === "unfilled";
  const shouldRender =
    Boolean(clientId) && isMounted && marketingAllowed && isInView && !shouldCollapse;

  useEffect(() => {
    if (!shouldRender || typeof window === "undefined") return;
    const ins = insRef.current;
    if (!ins) return;

    const clearUnfilledTimeout = () => {
      if (unfilledTimeoutRef.current !== null) {
        window.clearTimeout(unfilledTimeoutRef.current);
        unfilledTimeoutRef.current = null;
      }
    };

    const scheduleUnfilled = () => {
      if (!collapseOnUnfilled) return;
      if (!collapseAfterMs || collapseAfterMs <= 0) {
        setStatus("unfilled");
        return;
      }
      if (unfilledTimeoutRef.current !== null) return;
      unfilledTimeoutRef.current = window.setTimeout(() => {
        setStatus("unfilled");
        unfilledTimeoutRef.current = null;
      }, collapseAfterMs);
    };

    const updateStatus = () => {
      const next = ins.getAttribute("data-ad-status");
      if (next === "filled" || next === "unfilled") {
        if (next === "filled") {
          clearUnfilledTimeout();
          setStatus("filled");
        } else {
          if (status !== "filled") {
            scheduleUnfilled();
          }
        }
        return;
      }
      if (ins.getBoundingClientRect().height > 10) {
        clearUnfilledTimeout();
        setStatus("filled");
      }
    };

    const observer = new MutationObserver(updateStatus);
    observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });

    if (!hasPushedRef.current) {
      hasPushedRef.current = true;
      try {
        const win = window as any;
        win.adsbygoogle = win.adsbygoogle ?? [];
        win.adsbygoogle.push({});
      } catch (error) {
        console.warn("Ad slot push failed", error);
      }
    }

    updateStatus();

    return () => {
      clearUnfilledTimeout();
      observer.disconnect();
    };
  }, [shouldRender, slot, clientId, collapseOnUnfilled, collapseAfterMs, status]);

  if (!clientId || !isMounted || !marketingAllowed || shouldCollapse) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{ minHeight: shouldCollapse ? minHeight : 1 }}
      />
    );
  }

  const slotStyle = shouldRender
    ? {
        backgroundColor: "rgb(var(--color-background))",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        ...(status !== "filled" ? { minHeight } : {})
      }
    : { minHeight: 1 };

  return (
    <div ref={containerRef} className={className} style={slotStyle}>
      {shouldRender ? (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{
            display: "block",
            textAlign,
            visibility: status === "filled" ? "visible" : "hidden",
            backgroundColor: "transparent"
          }}
          data-ad-layout={adLayout ?? undefined}
          data-ad-layout-key={adLayoutKey}
          data-ad-format={adFormat}
          data-full-width-responsive={fullWidthResponsive ? "true" : undefined}
          data-ad-client={clientId}
          data-ad-slot={slot}
        />
      ) : null}
    </div>
  );
}
