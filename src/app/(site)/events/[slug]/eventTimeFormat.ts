type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const BASE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
};

export function formatInZone(date: Date, timeZone: string, includeZone = false): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...BASE_FORMAT,
    timeZone,
    ...(includeZone ? { timeZoneName: "short" } : {})
  });
  return formatter.format(date);
}

export function formatDateTimeLabel(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const month = lookup.month ?? "";
  const day = lookup.day ?? "";
  const year = lookup.year ?? "";
  const hour = lookup.hour ?? "";
  const minute = lookup.minute ?? "";
  const dayPeriod = lookup.dayPeriod ?? "";
  const timeLabel = dayPeriod ? `${hour}:${minute} ${dayPeriod}` : `${hour}:${minute}`;
  return `${month} ${day}, ${year} at ${timeLabel}`.trim();
}

export function formatLocalDateTimeLabel(date: Date, timeZone: string): string {
  const dateLabel = formatDateTimeLabel(date, timeZone);
  const zoneLong = extractTimeZoneName(date, timeZone, "long") ?? "local time";
  const zoneName = formatZoneName(zoneLong, timeZone);
  const offset =
    extractTimeZoneName(date, timeZone, "shortOffset") ||
    extractTimeZoneName(date, timeZone, "longOffset") ||
    extractTimeZoneName(date, timeZone, "short");
  const offsetLabel = offset && offset.includes("GMT") ? offset : formatOffsetLabel(date, timeZone);
  return `${dateLabel} ${zoneName} (${offsetLabel})`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes <= 0) return "less than a minute";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes || parts.length === 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function buildCountdown(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return "Event start time has passed.";

  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    `${days}d`,
    `${hours}h`,
    `${minutes}m`,
    `${seconds}s`
  ];
  return parts.join(" ");
}

export function buildEndCountdown(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return "Event has ended.";
  return buildCountdown(target, now);
}

function extractTimeZoneName(date: Date, timeZone: string, timeZoneName: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: timeZoneName as Intl.DateTimeFormatOptions["timeZoneName"]
    });
    return formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

function toDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second)
  };
}

function formatOffsetLabel(date: Date, timeZone: string): string {
  const utcParts = toDateParts(date, "UTC");
  const zoneParts = toDateParts(date, timeZone);
  const utcTime = Date.UTC(
    utcParts.year,
    utcParts.month - 1,
    utcParts.day,
    utcParts.hour,
    utcParts.minute,
    utcParts.second
  );
  const zoneTime = Date.UTC(
    zoneParts.year,
    zoneParts.month - 1,
    zoneParts.day,
    zoneParts.hour,
    zoneParts.minute,
    zoneParts.second
  );
  const offsetMinutes = Math.round((zoneTime - utcTime) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const minuteLabel = minutes ? `:${String(minutes).padStart(2, "0")}` : "";
  return `GMT${sign}${hours}${minuteLabel}`;
}

function formatZoneName(label: string, timeZone: string): string {
  if (timeZone.toLowerCase() === "asia/kolkata") {
    return "Indian standard time";
  }
  return label
    .replace(/\bStandard Time\b/g, "standard time")
    .replace(/\bDaylight Time\b/g, "daylight time");
}
