import {
  expenseRepository,
  noteRepository,
  parseExpense,
  parseNote,
  parseTask,
  taskRepository,
  type Expense,
  type Note,
  type Task,
} from "../../data/models";
import { isRecord, readJson, removeKey, writeJson } from "../../lib/storage";
import { WIDGETS } from "../../app/registry";
import { LAYOUT_KEY, LEGACY_FAVORITES_KEY, parseLayout, type DashboardLayout } from "../dashboard/layout";
import { COUNTERS_KEY, parseCounters } from "../life/counters";
import { EMERGENCY_KEY, parseMedical } from "../life/emergency";
import { EVENTS_KEY, parseEvents } from "../life/events";
import { HABITS_KEY, parseHabits } from "../life/habits";
import { parsePomodoro, POMODORO_KEY } from "../life/pomodoro";
import { parseWorldClock, WORLD_CLOCK_KEY } from "../life/worldClock";
import { TIMER_KEYS } from "../timer/persistence";
import { parsePrompts, PROMPTS_KEY } from "../ai-tools/prompts";
import { parseSignature, SIGNATURE_KEY } from "../files/signature";
import { KANBAN_KEY, parseKanban } from "../organize/kanban";
import { parseReminders, REMINDERS_KEY } from "../organize/reminders";
import { parseVault, VAULT_KEY } from "../organize/vault";
import { HOLIDAYS_KEY, parseHolidays } from "../thai/holidays";
import { parseSettings, SETTINGS_KEY, type Settings } from "./settings";

export const BACKUP_APP = "productivity-hub";
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/** Small per-tool data kept in LocalStorage, each with its own validator. */
export const TOOL_STORES: readonly { key: string; parse: (raw: unknown) => unknown }[] = [
  { key: HABITS_KEY, parse: parseHabits },
  { key: EVENTS_KEY, parse: parseEvents },
  { key: COUNTERS_KEY, parse: parseCounters },
  { key: POMODORO_KEY, parse: parsePomodoro },
  { key: WORLD_CLOCK_KEY, parse: parseWorldClock },
  { key: EMERGENCY_KEY, parse: parseMedical },
  { key: PROMPTS_KEY, parse: parsePrompts },
  { key: HOLIDAYS_KEY, parse: parseHolidays },
  { key: KANBAN_KEY, parse: parseKanban },
  { key: REMINDERS_KEY, parse: parseReminders },
  // Stays encrypted in the backup; the password is still needed to open it.
  { key: VAULT_KEY, parse: parseVault },
  { key: SIGNATURE_KEY, parse: parseSignature },
];

export interface BackupData {
  settings: Settings | null;
  layout: DashboardLayout | null;
  tasks: Task[];
  notes: Note[];
  /** null when the backup predates the expense tracker (leave current data alone). */
  expenses: Expense[] | null;
  /** Tool data by storage key; null when the backup predates tool data. */
  toolData: Record<string, unknown> | null;
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
}

export function buildBackup(data: BackupData, now: Date): BackupFile {
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), ...data };
}

export type ParsedBackup =
  | { ok: true; data: BackupData; skipped: number; exportedAt: string | null }
  | { ok: false; error: string };

/** Validates an imported backup. Imported content is untrusted. */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกิน 10 MB" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "ไฟล์ไม่ใช่ JSON ที่ถูกต้อง" };
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: "ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Productivity Hub" };
  if (typeof raw.formatVersion !== "number") return { ok: false, error: "ไม่พบเวอร์ชันของไฟล์สำรอง" };
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: "ไฟล์สำรองมาจากเวอร์ชันที่ใหม่กว่า กรุณาอัปเดตแอปก่อนนำเข้า" };
  }
  if (raw.formatVersion !== 1) return { ok: false, error: "เวอร์ชันไฟล์สำรองไม่รองรับ" };
  if (!Array.isArray(raw.tasks ?? []) || !Array.isArray(raw.notes ?? []) || !Array.isArray(raw.expenses ?? [])) {
    return { ok: false, error: "โครงสร้างข้อมูลในไฟล์ไม่ถูกต้อง" };
  }

  let skipped = 0;
  const collect = <T extends { id: string }>(list: unknown[], parse: (r: unknown) => T | null): T[] => {
    const out: T[] = [];
    const seen = new Set<string>();
    for (const entry of list) {
      const item = parse(entry);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      } else skipped++;
    }
    return out;
  };

  const tasks = collect((raw.tasks ?? []) as unknown[], parseTask);
  const notes = collect((raw.notes ?? []) as unknown[], parseNote);
  const settings = raw.settings == null ? null : parseSettings(raw.settings);
  const layout = raw.layout == null ? null : parseLayout(raw.layout, WIDGETS);
  const expenses = raw.expenses === undefined ? null : collect(raw.expenses as unknown[], parseExpense);
  let toolData: Record<string, unknown> | null = null;
  if (isRecord(raw.toolData)) {
    toolData = {};
    for (const { key, parse } of TOOL_STORES) {
      if (!(key in raw.toolData)) continue;
      const value = parse(raw.toolData[key]);
      if (value === null) skipped++;
      else toolData[key] = value;
    }
  }
  if (raw.settings != null && !settings) skipped++;
  if (raw.layout != null && !layout) skipped++;
  return {
    ok: true,
    data: { settings, layout, tasks, notes, expenses, toolData },
    skipped,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : null,
  };
}

export async function readBackupFile(file: File): Promise<ParsedBackup> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกิน 10 MB" };
  if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
    return { ok: false, error: "กรุณาเลือกไฟล์ .json" };
  }
  try {
    return parseBackup(await file.text());
  } catch {
    return { ok: false, error: "อ่านไฟล์ไม่สำเร็จ" };
  }
}

export async function collectCurrentData(): Promise<BackupData> {
  const settings = readJson(SETTINGS_KEY, parseSettings, null).value;
  const layout = readJson(LAYOUT_KEY, (r) => parseLayout(r, WIDGETS), null).value;
  const [tasks, notes, expenses] = await Promise.all([taskRepository.getAll(), noteRepository.getAll(), expenseRepository.getAll()]);
  const toolData: Record<string, unknown> = {};
  for (const { key, parse } of TOOL_STORES) {
    const value = readJson(key, parse, null).value;
    if (value !== null) toolData[key] = value;
  }
  return { settings, layout, tasks: tasks.items, notes: notes.items, expenses: expenses.items, toolData };
}

/** Replaces all stored data with the backup. Returns false if anything failed. */
export async function applyBackup(data: BackupData): Promise<boolean> {
  let ok = true;
  if (data.settings) ok = writeJson(SETTINGS_KEY, data.settings) && ok;
  if (data.layout) ok = writeJson(LAYOUT_KEY, data.layout) && ok;
  removeKey(LEGACY_FAVORITES_KEY);
  if (data.toolData) {
    for (const { key } of TOOL_STORES) {
      if (key in data.toolData) ok = writeJson(key, data.toolData[key]) && ok;
      else removeKey(key);
    }
  }
  await taskRepository.replaceAll(data.tasks);
  await noteRepository.replaceAll(data.notes);
  if (data.expenses) await expenseRepository.replaceAll(data.expenses);
  return ok;
}

export async function clearAllData(): Promise<void> {
  for (const key of [SETTINGS_KEY, LAYOUT_KEY, LEGACY_FAVORITES_KEY, ...TIMER_KEYS, ...TOOL_STORES.map((t) => t.key)]) removeKey(key);
  await taskRepository.replaceAll([]);
  await noteRepository.replaceAll([]);
  await expenseRepository.replaceAll([]);
}

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `productivity-hub-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function downloadJson(data: unknown, fileName: string): void {
  downloadText(JSON.stringify(data, null, 2), fileName, "application/json");
}

export function downloadText(text: string, fileName: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
