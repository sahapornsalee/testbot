import { createId } from "../../data/db";
import { MAX_TITLE_LENGTH, type Task } from "../../data/models";

export type TaskFilter = "all" | "active" | "done";

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  if (filter === "active") return tasks.filter((t) => !t.done);
  if (filter === "done") return tasks.filter((t) => t.done);
  return [...tasks];
}

/** Returns a cleaned title or an error message. */
export function validateTitle(title: string): { ok: true; title: string } | { ok: false; error: string } {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "กรุณาพิมพ์ชื่องาน" };
  if (trimmed.length > MAX_TITLE_LENGTH) return { ok: false, error: `ชื่องานยาวได้ไม่เกิน ${MAX_TITLE_LENGTH} ตัวอักษร` };
  return { ok: true, title: trimmed };
}

export function createTask(title: string, existing: readonly Task[], now: number): Task {
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);
  return { id: createId(), title, done: false, order: maxOrder + 1, createdAt: now, updatedAt: now };
}

/**
 * Moves a task one position up or down in the sorted list and returns only
 * the tasks whose order changed (to persist).
 */
export function moveTask(tasks: readonly Task[], id: string, direction: -1 | 1, now: number): Task[] {
  const sorted = sortTasks(tasks);
  const index = sorted.findIndex((t) => t.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= sorted.length) return [];
  const reordered = [...sorted];
  [reordered[index], reordered[target]] = [reordered[target] as Task, reordered[index] as Task];
  return reordered.flatMap((task, order) => (task.order === order ? [] : [{ ...task, order, updatedAt: now }]));
}
