import { isRecord } from "../lib/storage";
import { createRepository } from "./db";

export const MAX_TITLE_LENGTH = 500;
export const MAX_NOTE_LENGTH = 200_000;

export interface Task {
  id: string;
  title: string;
  done: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

const isTimestamp = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;

export function parseTask(raw: unknown): Task | null {
  if (!isRecord(raw)) return null;
  const { id, title, done, order, createdAt, updatedAt } = raw;
  if (!isId(id) || typeof title !== "string" || title.trim() === "" || title.length > MAX_TITLE_LENGTH) return null;
  if (typeof done !== "boolean" || typeof order !== "number" || !Number.isFinite(order)) return null;
  if (!isTimestamp(createdAt) || !isTimestamp(updatedAt)) return null;
  return { id, title, done, order, createdAt, updatedAt };
}

export function parseNote(raw: unknown): Note | null {
  if (!isRecord(raw)) return null;
  const { id, title, body, createdAt, updatedAt } = raw;
  if (!isId(id) || typeof title !== "string" || title.length > MAX_TITLE_LENGTH) return null;
  if (typeof body !== "string" || body.length > MAX_NOTE_LENGTH) return null;
  if (!isTimestamp(createdAt) || !isTimestamp(updatedAt)) return null;
  return { id, title, body, createdAt, updatedAt };
}

export const taskRepository = createRepository("tasks", parseTask);
export const noteRepository = createRepository("notes", parseNote);

export type ExpenseType = "income" | "expense";

export interface Expense {
  id: string;
  /** Calendar date "YYYY-MM-DD". */
  date: string;
  type: ExpenseType;
  amount: number;
  category: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export const MAX_AMOUNT = 1e12;

export function parseExpense(raw: unknown): Expense | null {
  if (!isRecord(raw)) return null;
  const { id, date, type, amount, category, note, createdAt, updatedAt } = raw;
  if (!isId(id) || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (type !== "income" && type !== "expense") return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  if (typeof category !== "string" || category.length === 0 || category.length > 50) return null;
  if (typeof note !== "string" || note.length > MAX_TITLE_LENGTH) return null;
  if (!isTimestamp(createdAt) || !isTimestamp(updatedAt)) return null;
  return { id, date, type, amount, category, note, createdAt, updatedAt };
}

export const expenseRepository = createRepository("expenses", parseExpense);
