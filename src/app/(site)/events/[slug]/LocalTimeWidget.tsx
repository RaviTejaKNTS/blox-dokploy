"use client";

import { useEffect, useState } from "react";

import { formatLocalDateTimeLabel } from "./eventTimeFormat";

type LocalTimeWidgetProps = {
  startUtc: string | null;
  endUtc?: string | null;
};

function useLocalTimeLabel(utc: string | null | undefined) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!utc) return;
    const parsed = new Date(utc);
    if (Number.isNaN(parsed.getTime())) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setLabel(formatLocalDateTimeLabel(parsed, timeZone));
  }, [utc]);

  return label;
}

export function LocalTimeWidget({ startUtc, endUtc }: LocalTimeWidgetProps) {
  const startLabel = useLocalTimeLabel(startUtc);
  const endLabel = useLocalTimeLabel(endUtc);

  if (!startUtc && !endUtc) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/60 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Local start time</p>
          <p className="text-sm font-semibold text-foreground">{startLabel ?? "Loading..."}</p>
        </div>
        {endUtc ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Local end time</p>
            <p className="text-sm font-semibold text-foreground">{endLabel ?? "Loading..."}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
