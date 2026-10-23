import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, resetDatabaseConnection } from "./db";
import { noteRepository, parseNote, parseTask, taskRepository, type Task } from "./models";

const task = (id: string, order: number, extra: Partial<Task> = {}): Task => ({
  id,
  title: `งาน ${id}`,
  done: false,
  order,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

afterEach(async () => {
  await taskRepository.replaceAll([]);
  await noteRepository.replaceAll([]);
});

describe("repositories", () => {
  it("stores, updates and deletes records", async () => {
    await taskRepository.put(task("a", 0));
    await taskRepository.put(task("b", 1));
    await taskRepository.put(task("a", 0, { done: true }));
    await taskRepository.remove("b");
    const { items } = await taskRepository.getAll();
    expect(items).toEqual([task("a", 0, { done: true })]);
  });

  it("persists across connections", async () => {
    await noteRepository.put({ id: "n", title: "t", body: "b", createdAt: 1, updatedAt: 2 });
    resetDatabaseConnection();
    expect((await noteRepository.getAll()).items).toHaveLength(1);
  });

  it("replaceAll swaps the whole store", async () => {
    await taskRepository.putMany([task("a", 0), task("b", 1)]);
    await taskRepository.replaceAll([task("c", 0)]);
    expect((await taskRepository.getAll()).items.map((t) => t.id)).toEqual(["c"]);
  });

  it("skips corrupted records instead of failing", async () => {
    const db = await openDatabase();
    const tx = db.transaction("tasks", "readwrite");
    tx.objectStore("tasks").put({ id: "bad", title: 42 });
    tx.objectStore("tasks").put(task("good", 0));
    await new Promise((resolve) => (tx.oncomplete = resolve));
    const result = await taskRepository.getAll();
    expect(result.items.map((t) => t.id)).toEqual(["good"]);
    expect(result.skipped).toBe(1);
  });
});

describe("model validation", () => {
  it("validates tasks", () => {
    expect(parseTask(task("x", 0))).not.toBeNull();
    expect(parseTask({ ...task("x", 0), title: "   " })).toBeNull();
    expect(parseTask({ ...task("x", 0), done: "no" })).toBeNull();
    expect(parseTask({ ...task("x", 0), order: Number.NaN })).toBeNull();
    expect(parseTask({ ...task("x", 0), title: "x".repeat(501) })).toBeNull();
    expect(parseTask("task")).toBeNull();
  });

  it("validates notes", () => {
    const note = { id: "n", title: "", body: "เนื้อหา", createdAt: 1, updatedAt: 1 };
    expect(parseNote(note)).toEqual(note);
    expect(parseNote({ ...note, body: 5 })).toBeNull();
    expect(parseNote({ ...note, createdAt: -1 })).toBeNull();
    expect(parseNote({ ...note, id: "" })).toBeNull();
  });
});
