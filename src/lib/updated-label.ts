import { differenceInCalendarDays, format, formatDistanceToNowStrict } from "date-fns";

export function formatUpdatedLabel(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffDays = Math.abs(differenceInCalendarDays(now, date));

  if (diffDays <= 4) {
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }

  return format(date, "MMM d, yyyy");
}
