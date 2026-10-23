import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DB_NAME } from "../../data/db";
import type { Expense } from "../../data/models";
import { expensesToCsv, summarizeMonth, validateExpense } from "./expenses";

const e = (date: string, type: "income" | "expense", amount: number, category: string, note = ""): Expense => ({
  id: `${date}-${amount}-${category}`,
  date,
  type,
  amount,
  category,
  note,
  createdAt: 1,
  updatedAt: 1,
});

describe("expenses", () => {
  it("validates drafts", () => {
    const ok = validateExpense({ date: "2026-10-23", type: "expense", amount: "1,250.555", category: "อาหาร", note: " ข้าว " }, 5);
    expect(ok.ok && ok.value).toMatchObject({ amount: 1250.56, note: "ข้าว", createdAt: 5 });
    expect(validateExpense({ date: "", type: "expense", amount: "1", category: "อาหาร", note: "" }, 1).ok).toBe(false);
    expect(validateExpense({ date: "2026-10-23", type: "expense", amount: "0", category: "อาหาร", note: "" }, 1).ok).toBe(false);
    expect(validateExpense({ date: "2026-10-23", type: "expense", amount: "abc", category: "อาหาร", note: "" }, 1).ok).toBe(false);
    expect(validateExpense({ date: "2026-10-23", type: "expense", amount: "5", category: " ", note: "" }, 1).ok).toBe(false);
  });

  it("summarizes a month", () => {
    const items = [
      e("2026-10-01", "income", 30000, "เงินเดือน"),
      e("2026-10-02", "expense", 150.5, "อาหาร"),
      e("2026-10-05", "expense", 49.5, "อาหาร"),
      e("2026-10-06", "expense", 800, "เดินทาง"),
      e("2026-09-30", "expense", 999, "อาหาร"),
    ];
    expect(summarizeMonth(items, "2026-10")).toEqual({
      income: 30000,
      expense: 1000,
      balance: 29000,
      byCategory: [
        { category: "เดินทาง", amount: 800, percent: 80 },
        { category: "อาหาร", amount: 200, percent: 20 },
      ],
    });
    expect(summarizeMonth(items, "2026-11")).toEqual({ income: 0, expense: 0, balance: 0, byCategory: [] });
  });

  it("exports safe CSV for Excel", () => {
    const csv = expensesToCsv([e("2026-10-02", "expense", 10, "อาหาร", '=HYPERLINK("x") "quoted"')]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"") ""quoted"""`);
    expect(csv).toContain('"รายจ่าย"');
  });

  it("upgrades a v1 database without losing tasks", async () => {
    const { resetDatabaseConnection } = await import("../../data/db");
    resetDatabaseConnection();
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => resolve();
      del.onerror = () => resolve();
    });
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("tasks", { keyPath: "id" }).put({ id: "t", title: "เก่า", done: false, order: 0, createdAt: 1, updatedAt: 1 });
        open.result.createObjectStore("notes", { keyPath: "id" });
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });
    const { taskRepository, expenseRepository } = await import("../../data/models");
    expect((await taskRepository.getAll()).items.map((t) => t.title)).toEqual(["เก่า"]);
    await expenseRepository.put(e("2026-10-01", "expense", 1, "อาหาร"));
    expect((await expenseRepository.getAll()).items).toHaveLength(1);
    await taskRepository.replaceAll([]);
    await expenseRepository.replaceAll([]);
  });
});
