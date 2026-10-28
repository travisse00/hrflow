// Every "what day is it?" question in the app goes through this file, so attendance,
// leave and the dashboard can never disagree about where midnight falls.

export const ORG_TIMEZONE = process.env.ORG_TIMEZONE ?? "Africa/Lagos";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ORG_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-27": the calendar day of `date` in the organisation's timezone. */
export function dayKeyFor(date: Date = new Date()): string {
  return dayKeyFormatter.format(date);
}

/** Date-only values (leave dates) are stored as midnight UTC of that day. */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(key: string, days: number): string {
  const d = dayKeyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromKey: string, toKey: string): number {
  return Math.round((dayKeyToDate(toKey).getTime() - dayKeyToDate(fromKey).getTime()) / 86_400_000);
}

/** The last `n` day keys ending at `end`, oldest first. */
export function lastNDayKeys(n: number, end: string = dayKeyFor()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", // date-only values are stored as UTC midnight
  day: "numeric",
  month: "short",
  year: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ORG_TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ORG_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const formatDay = (date: Date) => dayFormatter.format(date);
export const formatDayKey = (key: string) => dayFormatter.format(dayKeyToDate(key));
export const weekdayOfKey = (key: string) => weekdayFormatter.format(dayKeyToDate(key));
export const formatDateTime = (date: Date) => dateTimeFormatter.format(date);
export const formatTime = (date: Date) => timeFormatter.format(date);

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
