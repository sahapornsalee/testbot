import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";
import { addDays, parseIsoDate, toIsoDate, type CalendarDate } from "../calendar/dates";

export const HABITS_KEY = "productivity-hub:habits";
export const MAX_HABITS = 50;
const MAX_DAYS_KEPT = 1000;

export interface Habit {
  id: string;
  name: string;
  createdAt: number;
  /** ISO dates ("YYYY-MM-DD") the habit was done, sorted ascending. */
  done: string[];
}

export interface HabitsData {
  version: 1;
  habits: Habit[];
}

export const EMPTY_HABITS: HabitsData = { version: 1, habits: [] };

export function parseHabits(raw: unknown): HabitsData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.habits)) return null;
  const habits: Habit[] = [];
  for (const h of raw.habits.slice(0, MAX_HABITS)) {
    if (!isRecord(h) || typeof h.id !== "string" || typeof h.name !== "string" || !h.name.trim()) continue;
    if (typeof h.createdAt !== "number" || !Array.isArray(h.done)) continue;
    const done = [...new Set(h.done.filter((d): d is string => typeof d === "string" && parseIsoDate(d) !== null))].sort();
    habits.push({ id: h.id, name: h.name.slice(0, 100), createdAt: h.createdAt, done: done.slice(-MAX_DAYS_KEPT) });
  }
  return { version: 1, habits };
}

export function addHabit(data: HabitsData, name: string, now: number): HabitsData {
  const clean = name.trim().slice(0, 100);
  if (!clean || data.habits.length >= MAX_HABITS) return data;
  return { ...data, habits: [...data.habits, { id: createId(), name: clean, createdAt: now, done: [] }] };
}

export function removeHabit(data: HabitsData, id: string): HabitsData {
  return { ...data, habits: data.habits.filter((h) => h.id !== id) };
}

export function toggleDay(data: HabitsData, id: string, date: CalendarDate): HabitsData {
  const iso = toIsoDate(date);
  return {
    ...data,
    habits: data.habits.map((h) =>
      h.id !== id ? h : { ...h, done: h.done.includes(iso) ? h.done.filter((d) => d !== iso) : [...h.done, iso].sort().slice(-MAX_DAYS_KEPT) },
    ),
  };
}

/** Consecutive days done ending today (or yesterday, so a streak is not lost before today's check). */
export function currentStreak(habit: Habit, today: CalendarDate): number {
  const done = new Set(habit.done);
  let day = done.has(toIsoDate(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(toIsoDate(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit): number {
  let best = 0;
  let run = 0;
  let previous: CalendarDate | null = null;
  for (const iso of habit.done) {
    const date = parseIsoDate(iso);
    if (!date) continue;
    run = previous && toIsoDate(addDays(previous, 1)) === iso ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

export function lastDays(today: CalendarDate, count: number): CalendarDate[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}
