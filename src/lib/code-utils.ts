import type { Code } from "./db";

export const NEW_CODE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

export function cleanRewardsText(text?: string | null): string | null {
  if (!text) return null;
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^New Code/i, "").trim();
  t = t.replace(/^Copy/i, "").trim();
  t = t.replace(/\s*(Active|Expired|Check)\s*$/i, "").trim();
  t = t.replace(/this code credits your account with/i, "This code gives you");
  return t || null;
}

function firstSeenTimestamp(code: Pick<Code, "first_seen_at">): number | null {
  if (!code.first_seen_at) return null;
  const time = new Date(code.first_seen_at).getTime();
  return Number.isNaN(time) ? null : time;
}

export function sortCodesByFirstSeenDesc<T extends Pick<Code, "first_seen_at">>(codes: T[]): T[] {
  return [...codes].sort((a, b) => {
    const aTime = firstSeenTimestamp(a);
    const bTime = firstSeenTimestamp(b);
    if (aTime === bTime) return 0;
    if (aTime == null) return 1;
    if (bTime == null) return -1;
    return bTime - aTime;
  });
}

export function isCodeWithinNewThreshold(code: Pick<Code, "first_seen_at">, referenceMs: number): boolean {
  const firstSeenMs = firstSeenTimestamp(code);
  if (firstSeenMs == null) return false;
  return referenceMs - firstSeenMs <= NEW_CODE_THRESHOLD_MS;
}
