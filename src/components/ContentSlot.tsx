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
  textAlign = "center"
}: ContentSlotProps) {
  const { requiresConsent, state, shouldShowBanner } = useConsent();
  const [isMounted, setIsMounted] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [status, setStatus] = useState<AdStatus>("unknown");
  const insRef = useRef<HTMLModElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPushedRef = useRef(false);

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

  const shouldRender =
    Boolean(clientId) && isMounted && marketingAllowed && isInView && status !== "unfilled";

  useEffect(() => {
    if (!shouldRender || typeof window === "undefined") return;
    const ins = insRef.current;
    if (!ins) return;

    const updateStatus = () => {
      const next = ins.getAttribute("data-ad-status");
      if (next === "filled" || next === "unfilled") {
        setStatus(next);
        return;
      }
      if (ins.getBoundingClientRect().height > 10) {
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

    const timeout = window.setTimeout(() => {
      if (ins.getAttribute("data-ad-status") !== "filled" && ins.getBoundingClientRect().height < 10) {
        setStatus("unfilled");
      }
    }, 6000);

    updateStatus();

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [shouldRender, slot, clientId]);

  if (!clientId || !isMounted || !marketingAllowed || status === "unfilled") {
    return <div ref={containerRef} className={className} style={{ minHeight: 1 }} />;
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
