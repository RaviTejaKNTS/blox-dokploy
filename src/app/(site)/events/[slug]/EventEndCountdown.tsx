"use client";

import { useEffect, useMemo, useState } from "react";

import { buildEndCountdown } from "./eventTimeFormat";

type EventEndCountdownProps = {
  endUtc: string | null;
  initialLabel?: string | null;
};

export function EventEndCountdown({ endUtc, initialLabel }: EventEndCountdownProps) {
  const target = useMemo(() => {
    if (!endUtc) return null;
    const parsed = new Date(endUtc);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }, [endUtc]);

  const fallbackLabel = "End time not announced.";
  const [label, setLabel] = useState(() => initialLabel ?? fallbackLabel);

  useEffect(() => {
    if (!target) {
      setLabel(fallbackLabel);
      return;
    }

    const tick = () => setLabel(buildEndCountdown(target, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-sm font-semibold text-foreground shadow-soft">
      {label}
    </div>
  );
}
