import { describe, expect, it } from "vitest";
import { noteRepository, taskRepository } from "../../data/models";
import { readJson } from "../../lib/storage";
import { LAYOUT_KEY } from "../dashboard/layout";
import {
  applyBackup,
  buildBackup,
  clearAllData,
  collectCurrentData,
  MAX_BACKUP_BYTES,
  parseBackup,
  readBackupFile,
} from "./backup";
import { SETTINGS_KEY } from "./settings";

const task = { id: "t1", title: "งาน", done: false, order: 0, createdAt: 1, updatedAt: 1 };
const note = { id: "n1", title: "โน้ต", body: "เนื้อหา", createdAt: 1, updatedAt: 1 };
const settings = { version: 1 as const, theme: "dark" as const, timeFormat: "12h" as const };
const layout = { version: 2 as const, columns: 2 as const, items: [{ id: "notes", size: "large" as const, hidden: false }] };

describe("backup parsing", () => {
  it("round-trips a full backup", () => {
    const file = buildBackup({ settings, layout, tasks: [task], notes: [note] }, new Date("2026-10-23T00:00:00Z"));
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed).toEqual({
      ok: true,
      data: { settings, layout, tasks: [task], notes: [note] },
      skipped: 0,
      exportedAt: "2026-10-23T00:00:00.000Z",
    });
  });

  it("rejects files that are not backups", () => {
    expect(parseBackup("not json")).toMatchObject({ ok: false, error: "ไฟล์ไม่ใช่ JSON ที่ถูกต้อง" });
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "other", formatVersion: 1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "productivity-hub" })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "productivity-hub", formatVersion: 1, tasks: "x" })).ok).toBe(false);
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
        settings: { version: 9 },
      }),
    );
    expect(result.ok && result.data.tasks).toEqual([task]);
    expect(result.ok && result.data.notes).toEqual([note]);
    expect(result.ok && result.data.settings).toBeNull();
    expect(result.ok && result.skipped).toBe(5);
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
    await applyBackup({ settings, layout, tasks: [task], notes: [note] });
    const current = await collectCurrentData();
    expect(current).toEqual({ settings, layout, tasks: [task], notes: [note] });
  });

  it("clears all data", async () => {
    await applyBackup({ settings, layout, tasks: [task], notes: [note] });
    await clearAllData();
    expect(readJson(SETTINGS_KEY, (r) => r, null).value).toBeNull();
    expect(readJson(LAYOUT_KEY, (r) => r, null).value).toBeNull();
    expect((await taskRepository.getAll()).items).toEqual([]);
    expect((await noteRepository.getAll()).items).toEqual([]);
  });
});
