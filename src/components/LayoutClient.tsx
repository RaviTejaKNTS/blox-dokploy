"use client";

import dynamic from "next/dynamic";

const GlobalSearchOverlay = dynamic(
  () =>
    import("@/components/GlobalSearchOverlay").then((mod) => ({
      default: mod.GlobalSearchOverlay
    })),
  { ssr: false, loading: () => null }
);

const VercelAnalytics = dynamic(() => import("@vercel/analytics/react").then((mod) => mod.Analytics), {
  ssr: false,
  loading: () => null
});

const VercelSpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights), {
  ssr: false,
  loading: () => null
});

export function LayoutClientAnalytics() {
  return (
    <>
      <VercelAnalytics />
      <VercelSpeedInsights />
    </>
  );
}

export function LayoutGlobalSearch() {
  return <GlobalSearchOverlay />;
}
