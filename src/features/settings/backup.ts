import { noteRepository, parseNote, parseTask, taskRepository, type Note, type Task } from "../../data/models";
import { isRecord, readJson, removeKey, writeJson } from "../../lib/storage";
import { WIDGETS } from "../../app/registry";
import { LAYOUT_KEY, LEGACY_FAVORITES_KEY, parseLayout, type DashboardLayout } from "../dashboard/layout";
import { TIMER_KEYS } from "../timer/persistence";
import { parseSettings, SETTINGS_KEY, type Settings } from "./settings";

export const BACKUP_APP = "productivity-hub";
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export interface BackupData {
  settings: Settings | null;
  layout: DashboardLayout | null;
  tasks: Task[];
  notes: Note[];
}

export interface BackupFile extends Omit<BackupData, "settings" | "layout"> {
  app: typeof BACKUP_APP;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  settings: Settings | null;
  layout: DashboardLayout | null;
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
  if (!Array.isArray(raw.tasks ?? []) || !Array.isArray(raw.notes ?? [])) {
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
  if (raw.settings != null && !settings) skipped++;
  if (raw.layout != null && !layout) skipped++;
  return {
    ok: true,
    data: { settings, layout, tasks, notes },
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
  const [tasks, notes] = await Promise.all([taskRepository.getAll(), noteRepository.getAll()]);
  return { settings, layout, tasks: tasks.items, notes: notes.items };
}

/** Replaces all stored data with the backup. Returns false if anything failed. */
export async function applyBackup(data: BackupData): Promise<boolean> {
  let ok = true;
  if (data.settings) ok = writeJson(SETTINGS_KEY, data.settings) && ok;
  if (data.layout) ok = writeJson(LAYOUT_KEY, data.layout) && ok;
  removeKey(LEGACY_FAVORITES_KEY);
  await taskRepository.replaceAll(data.tasks);
  await noteRepository.replaceAll(data.notes);
  return ok;
}

export async function clearAllData(): Promise<void> {
  for (const key of [SETTINGS_KEY, LAYOUT_KEY, LEGACY_FAVORITES_KEY, ...TIMER_KEYS]) removeKey(key);
  await taskRepository.replaceAll([]);
  await noteRepository.replaceAll([]);
}

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `productivity-hub-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
