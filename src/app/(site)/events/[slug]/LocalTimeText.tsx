"use client";

import { useEffect, useState } from "react";

import { formatLocalDateTimeLabel } from "./eventTimeFormat";

type LocalTimeTextProps = {
  utc: string | null | undefined;
  prefix?: string;
  suffix?: string;
};

export function LocalTimeText({ utc, prefix = "", suffix = "" }: LocalTimeTextProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!utc) return;
    const parsed = new Date(utc);
    if (Number.isNaN(parsed.getTime())) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setLabel(formatLocalDateTimeLabel(parsed, timeZone));
  }, [utc]);

  if (!label) return null;

  return (
    <p>
      {prefix}
      {label}
      {suffix}
    </p>
  );
}
