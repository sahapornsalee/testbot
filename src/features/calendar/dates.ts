/** Calendar-date helpers. Dates are plain {year, month, day} to avoid time zone bugs. */

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

const DAY_MS = 86_400_000;

export function toUtcMs(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

export function fromUtcMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function today(now = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function sameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses "YYYY-MM-DD" (the value of <input type="date">); rejects impossible dates. */
export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > daysInMonth(date.year, date.month)) return null;
  return date;
}

export function toIsoDate(date: CalendarDate): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`;
}

/** Signed number of days from `a` to `b` (b - a). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMs(toUtcMs(date) + Math.trunc(days) * DAY_MS);
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export interface DayCell {
  date: CalendarDate;
  inMonth: boolean;
}

/** 6x7 grid for a month view, weeks starting on Sunday (0) or Monday (1). */
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0): DayCell[] {
  const first = { year, month, day: 1 };
  const weekday = new Date(toUtcMs(first)).getUTCDay();
  const offset = (weekday - weekStartsOn + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.month === month && date.year === year };
  });
}

/** Breaks a day span into years, months and days (calendar-aware). */
export function diffParts(a: CalendarDate, b: CalendarDate): { years: number; months: number; days: number } {
  const [from, to] = toUtcMs(a) <= toUtcMs(b) ? [a, b] : [b, a];
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) months--;
  const anchor = addMonths(from.year, from.month, months);
  const anchorDay = Math.min(from.day, daysInMonth(anchor.year, anchor.month));
  const days = daysBetween({ ...anchor, day: anchorDay }, to);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

export function monthName(month: number, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("th-TH", { month: style, timeZone: "UTC" }).format(Date.UTC(2000, month - 1, 1));
}

export function weekdayNames(weekStartsOn: 0 | 1 = 0): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" }).format(
      Date.UTC(2023, 0, 1 + ((i + weekStartsOn) % 7)),
    ),
  );
}

export function formatThaiDate(date: CalendarDate): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "UTC" }).format(toUtcMs(date));
}

/** Buddhist Era year shown alongside the Gregorian year. */
export function buddhistYear(year: number): number {
  return year + 543;
}
