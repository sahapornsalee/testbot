import { describe, expect, it } from "vitest";
import type { Task } from "../../data/models";
import { createTask, filterTasks, moveTask, sortTasks, validateTitle } from "./tasks";

const t = (id: string, order: number, done = false): Task => ({ id, title: id, done, order, createdAt: order, updatedAt: 0 });

describe("tasks", () => {
  it("validates and normalizes titles", () => {
    expect(validateTitle("  ซื้อ   ของ  ")).toEqual({ ok: true, title: "ซื้อ ของ" });
    expect(validateTitle("   ").ok).toBe(false);
    expect(validateTitle("x".repeat(501)).ok).toBe(false);
  });

  it("appends new tasks at the end", () => {
    const task = createTask("ใหม่", [t("a", 0), t("b", 5)], 100);
    expect(task.order).toBe(6);
    expect(task.done).toBe(false);
    expect(createTask("first", [], 1).order).toBe(0);
  });

  it("sorts and filters", () => {
    const tasks = [t("b", 1, true), t("a", 0)];
    expect(sortTasks(tasks).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filterTasks(tasks, "active").map((x) => x.id)).toEqual(["a"]);
    expect(filterTasks(tasks, "done").map((x) => x.id)).toEqual(["b"]);
    expect(filterTasks(tasks, "all")).toHaveLength(2);
  });

  it("moves tasks and returns only changed records", () => {
    const tasks = [t("a", 0), t("b", 1), t("c", 2)];
    const changed = moveTask(tasks, "c", -1, 9);
    expect(changed.map((x) => [x.id, x.order])).toEqual([
      ["c", 1],
      ["b", 2],
    ]);
    expect(moveTask(tasks, "a", -1, 9)).toEqual([]);
    expect(moveTask(tasks, "missing", 1, 9)).toEqual([]);
  });

  it("normalizes gaps in order when moving", () => {
    const changed = moveTask([t("a", 3), t("b", 10)], "b", -1, 1);
    expect(changed.map((x) => [x.id, x.order])).toEqual([
      ["b", 0],
      ["a", 1],
    ]);
  });
});
