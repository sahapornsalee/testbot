import type { TimeFormat } from "../settings/settings";

export const LOCALE = "th-TH";

export function formatTime(date: Date, timeFormat: TimeFormat, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12h",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatLongDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** Formats a UTC offset in minutes (as returned by -Date#getTimezoneOffset) like "UTC+07:00". */
export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "ไม่ทราบเขตเวลา";
  } catch {
    return "ไม่ทราบเขตเวลา";
  }
}
