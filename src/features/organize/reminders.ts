import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const REMINDERS_KEY = "productivity-hub:reminders";
export const MAX_REMINDERS = 200;

export interface Reminder {
  id: string;
  title: string;
  /** Due time (epoch ms). */
  at: number;
  done: boolean;
  /** True once the alert has been shown, so it fires only once. */
  notified: boolean;
}

export interface RemindersData {
  version: 1;
  reminders: Reminder[];
}

export const EMPTY_REMINDERS: RemindersData = { version: 1, reminders: [] };

export function parseReminders(raw: unknown): RemindersData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.reminders)) return null;
  const reminders: Reminder[] = [];
  for (const r of raw.reminders.slice(0, MAX_REMINDERS)) {
    if (!isRecord(r) || typeof r.id !== "string" || typeof r.title !== "string" || !r.title.trim()) continue;
    if (typeof r.at !== "number" || !Number.isFinite(r.at)) continue;
    reminders.push({ id: r.id, title: r.title.slice(0, 200), at: r.at, done: r.done === true, notified: r.notified === true });
  }
  return { version: 1, reminders };
}

export function createReminder(title: string, at: number): Reminder | null {
  const clean = title.trim().slice(0, 200);
  if (!clean || !Number.isFinite(at)) return null;
  return { id: createId(), title: clean, at, done: false, notified: false };
}

/** Reminders that are due now and have not alerted yet. */
export function dueReminders(data: RemindersData, now: number): Reminder[] {
  return data.reminders.filter((r) => !r.done && !r.notified && r.at <= now).sort((a, b) => a.at - b.at);
}

export function markNotified(data: RemindersData, ids: readonly string[]): RemindersData {
  return { ...data, reminders: data.reminders.map((r) => (ids.includes(r.id) ? { ...r, notified: true } : r)) };
}

export function snooze(data: RemindersData, id: string, now: number, minutes: number): RemindersData {
  return { ...data, reminders: data.reminders.map((r) => (r.id === id ? { ...r, at: now + minutes * 60_000, notified: false, done: false } : r)) };
}

export function setDone(data: RemindersData, id: string, done: boolean): RemindersData {
  return { ...data, reminders: data.reminders.map((r) => (r.id === id ? { ...r, done, notified: true } : r)) };
}

export function sortReminders(list: readonly Reminder[]): Reminder[] {
  return [...list].sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at);
}
