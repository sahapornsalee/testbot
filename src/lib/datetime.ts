/**
 * Date/time formatting driven by the user's settings rather than the device.
 * Defaults are Thai: Asia/Bangkok time and Thai dates in the Buddhist era.
 */

export type DateLocale = "th" | "en-GB";

export interface DateTimeConfig {
  locale: DateLocale;
  /** IANA time zone, e.g. "Asia/Bangkok". */
  timeZone: string;
}

export const DEFAULT_TIME_ZONE = "Asia/Bangkok";
export const DEFAULT_DATE_TIME: DateTimeConfig = { locale: "th", timeZone: DEFAULT_TIME_ZONE };

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export function localeTag(locale: DateLocale): string {
  return locale === "th" ? "th-TH" : "en-GB";
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function zoneParts(zone: string, date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

/** Offset of `zone` from UTC in minutes at instant `date`. */
export function zoneOffsetMinutes(zone: string, date: Date): number {
  const p = zoneParts(zone, date);
  const asUtc = Date.UTC(p.year as number, (p.month as number) - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** The calendar date in `zone` at instant `now`. */
export function todayIn(zone: string, now: Date = new Date()): CalendarDate {
  const p = zoneParts(zone, now);
  return { year: p.year as number, month: p.month as number, day: p.day as number };
}

/** Formats a UTC offset in minutes like "UTC+07:00". */
export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Year as shown to the user: Buddhist era (พ.ศ.) for Thai, Common era otherwise. */
export function displayYear(year: number, locale: DateLocale): number {
  return locale === "th" ? year + 543 : year;
}

export function fromDisplayYear(year: number, locale: DateLocale): number {
  return locale === "th" ? year - 543 : year;
}

const utcNoon = (date: CalendarDate) => Date.UTC(date.year, date.month - 1, date.day, 12);

/** A calendar date (no time zone shift) in the chosen locale. */
export function formatDate(date: CalendarDate, locale: DateLocale, style: "full" | "long" | "medium" | "short" = "full"): string {
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: style, timeZone: "UTC" }).format(utcNoon(date));
}

export function monthName(month: number, locale: DateLocale, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(localeTag(locale), { month: style, timeZone: "UTC" }).format(Date.UTC(2000, month - 1, 1, 12));
}

/**
 * Standard Thai weekday abbreviations. Fixed here because browsers ship
 * different ICU data: some abbreviate Sunday as "อา.", others print the full
 * "อาทิตย์", which would make calendar headers differ between devices.
 */
const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/** Short weekday names starting on Sunday (0) or Monday (1). */
export function weekdayNames(locale: DateLocale, weekStartsOn: 0 | 1 = 0): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = (i + weekStartsOn) % 7;
    if (locale === "th") return THAI_WEEKDAYS[day] as string;
    // 1 January 2023 was a Sunday.
    return new Intl.DateTimeFormat(localeTag(locale), { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2023, 0, 1 + day, 12));
  });
}

export function formatTime(date: Date, config: DateTimeConfig, hour12: boolean, withSeconds = true): string {
  return new Intl.DateTimeFormat(localeTag(config.locale), {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12,
    timeZone: config.timeZone,
  }).format(date);
}

/** An instant (timestamp) shown as date + time in the chosen zone. */
export function formatDateTime(timestamp: number, config: DateTimeConfig): string {
  return new Intl.DateTimeFormat(localeTag(config.locale), { dateStyle: "medium", timeStyle: "short", timeZone: config.timeZone }).format(timestamp);
}

/** Long weekday + date of an instant in the chosen zone. */
export function formatLongDate(date: Date, config: DateTimeConfig): string {
  return new Intl.DateTimeFormat(localeTag(config.locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: config.timeZone,
  }).format(date);
}
