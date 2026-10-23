import { describe, expect, it } from "vitest";
import { expenseRepository, noteRepository, taskRepository } from "../../data/models";
import { readJson, writeJson } from "../../lib/storage";
import { LAYOUT_KEY } from "../dashboard/layout";
import { HABITS_KEY } from "../life/habits";
import { EMERGENCY_KEY } from "../life/emergency";
import {
  applyBackup,
  buildBackup,
  clearAllData,
  collectCurrentData,
  MAX_BACKUP_BYTES,
  parseBackup,
  readBackupFile,
  type BackupData,
} from "./backup";
import { SETTINGS_KEY } from "./settings";

const task = { id: "t1", title: "งาน", done: false, order: 0, createdAt: 1, updatedAt: 1 };
const note = { id: "n1", title: "โน้ต", body: "เนื้อหา", createdAt: 1, updatedAt: 1 };
const expense = { id: "e1", date: "2026-10-23", type: "expense" as const, amount: 120, category: "อาหาร", note: "", createdAt: 1, updatedAt: 1 };
const settings = { version: 1 as const, theme: "dark" as const, timeFormat: "12h" as const, dateLocale: "en-GB" as const, timeZone: "Europe/London" };
const layout = { version: 2 as const, columns: 2 as const, items: [{ id: "notes", size: "large" as const, hidden: false }] };
const habits = { version: 1, habits: [{ id: "h", name: "ดื่มน้ำ", createdAt: 1, done: ["2026-10-22"] }] };
const full: BackupData = { settings, layout, tasks: [task], notes: [note], expenses: [expense], toolData: { [HABITS_KEY]: habits } };

describe("backup parsing", () => {
  it("round-trips a full backup", () => {
    const file = buildBackup(full, new Date("2026-10-23T00:00:00Z"));
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: true, data: full, skipped: 0, exportedAt: "2026-10-23T00:00:00.000Z" });
  });

  it("reads backups made before expenses and tool data existed", () => {
    const old = { app: "productivity-hub", formatVersion: 1, tasks: [task], notes: [] };
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.ok && parsed.data.expenses).toBeNull();
    expect(parsed.ok && parsed.data.toolData).toBeNull();
  });

  it("rejects files that are not backups", () => {
    expect(parseBackup("not json")).toMatchObject({ ok: false, error: "ไฟล์ไม่ใช่ JSON ที่ถูกต้อง" });
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "other", formatVersion: 1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "productivity-hub" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "productivity-hub", formatVersion: 1, tasks: "x" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "productivity-hub", formatVersion: 1, expenses: {} })).ok).toBe(false);
  });

  it("rejects backups from a newer format", () => {
    const result = parseBackup(JSON.stringify({ app: "productivity-hub", formatVersion: 2 }));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain("ใหม่กว่า");
  });

  it("drops invalid and duplicate records and counts them", () => {
    const result = parseBackup(
      JSON.stringify({
        app: "productivity-hub",
        formatVersion: 1,
        tasks: [task, task, { id: "bad" }, "<script>"],
        notes: [note, { ...note, id: "n2", body: 3 }],
        expenses: [expense, { ...expense, id: "e2", amount: -5 }],
        settings: { version: 9 },
        toolData: { [HABITS_KEY]: { version: 7 }, "unknown-key": { x: 1 } },
      }),
    );
    expect(result.ok && result.data.tasks).toEqual([task]);
    expect(result.ok && result.data.notes).toEqual([note]);
    expect(result.ok && result.data.expenses).toEqual([expense]);
    expect(result.ok && result.data.settings).toBeNull();
    expect(result.ok && result.data.toolData).toEqual({});
    expect(result.ok && result.skipped).toBe(7);
  });

  it("checks file size and type before reading", async () => {
    const big = new File(["x"], "big.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: MAX_BACKUP_BYTES + 1 });
    expect(await readBackupFile(big)).toMatchObject({ ok: false, error: "ไฟล์ใหญ่เกิน 10 MB" });
    expect(await readBackupFile(new File(["{}"], "a.txt", { type: "text/plain" }))).toMatchObject({ ok: false });
  });
});

describe("applying backups", () => {
  it("replaces current data and can be exported again", async () => {
    await taskRepository.put({ ...task, id: "old" });
    writeJson(EMERGENCY_KEY, { version: 1, name: "จะถูกลบ" });
    await applyBackup(full);
    expect(await collectCurrentData()).toEqual(full);
    expect(readJson(EMERGENCY_KEY, (r) => r, null).value).toBeNull();
  });

  it("keeps expenses and tool data when importing an older backup", async () => {
    await applyBackup(full);
    await applyBackup({ ...full, tasks: [], expenses: null, toolData: null });
    const current = await collectCurrentData();
    expect(current.tasks).toEqual([]);
    expect(current.expenses).toEqual([expense]);
    expect(current.toolData).toEqual({ [HABITS_KEY]: habits });
  });

  it("clears all data", async () => {
    await applyBackup(full);
    await clearAllData();
    expect(readJson(SETTINGS_KEY, (r) => r, null).value).toBeNull();
    expect(readJson(LAYOUT_KEY, (r) => r, null).value).toBeNull();
    expect(readJson(HABITS_KEY, (r) => r, null).value).toBeNull();
    expect((await taskRepository.getAll()).items).toEqual([]);
    expect((await noteRepository.getAll()).items).toEqual([]);
    expect((await expenseRepository.getAll()).items).toEqual([]);
  });
});
