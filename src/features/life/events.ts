import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";
import { daysBetween, daysInMonth, parseIsoDate, type CalendarDate } from "../calendar/dates";

export const EVENTS_KEY = "productivity-hub:events";
export const MAX_EVENTS = 100;

export interface CountdownEvent {
  id: string;
  title: string;
  date: string;
  /** Repeats every year (birthdays, anniversaries). */
  yearly: boolean;
}

export interface EventsData {
  version: 1;
  events: CountdownEvent[];
}

export const EMPTY_EVENTS: EventsData = { version: 1, events: [] };

export function parseEvents(raw: unknown): EventsData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.events)) return null;
  const events: CountdownEvent[] = [];
  for (const e of raw.events.slice(0, MAX_EVENTS)) {
    if (!isRecord(e) || typeof e.id !== "string" || typeof e.title !== "string" || !e.title.trim()) continue;
    if (typeof e.date !== "string" || !parseIsoDate(e.date)) continue;
    events.push({ id: e.id, title: e.title.slice(0, 100), date: e.date, yearly: e.yearly === true });
  }
  return { version: 1, events };
}

export function createEvent(title: string, date: string, yearly: boolean): CountdownEvent | null {
  const clean = title.trim().slice(0, 100);
  if (!clean || !parseIsoDate(date)) return null;
  return { id: createId(), title: clean, date, yearly };
}

/** Next occurrence on or after today (yearly events roll over; 29 Feb uses 28 Feb). */
export function nextOccurrence(event: CountdownEvent, today: CalendarDate): CalendarDate {
  const date = parseIsoDate(event.date) as CalendarDate;
  if (!event.yearly) return date;
  const inYear = (year: number) => ({ year, month: date.month, day: Math.min(date.day, daysInMonth(year, date.month)) });
  const thisYear = inYear(today.year);
  return daysBetween(today, thisYear) >= 0 ? thisYear : inYear(today.year + 1);
}

export function daysUntil(event: CountdownEvent, today: CalendarDate): number {
  return daysBetween(today, nextOccurrence(event, today));
}

/** Upcoming first (soonest), then past events (most recent first). */
export function sortEvents(events: readonly CountdownEvent[], today: CalendarDate): CountdownEvent[] {
  return [...events].sort((a, b) => {
    const da = daysUntil(a, today);
    const db = daysUntil(b, today);
    if (da >= 0 && db >= 0) return da - db;
    if (da < 0 && db < 0) return db - da;
    return da >= 0 ? -1 : 1;
  });
}
