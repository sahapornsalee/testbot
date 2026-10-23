import { createId } from "../../data/db";
import { MAX_AMOUNT, type Expense, type ExpenseType } from "../../data/models";

export const EXPENSE_CATEGORIES = ["อาหาร", "เดินทาง", "ที่พัก/ค่าเช่า", "สาธารณูปโภค", "ช้อปปิ้ง", "สุขภาพ", "การศึกษา", "บันเทิง", "อื่น ๆ"];
export const INCOME_CATEGORIES = ["เงินเดือน", "รายได้เสริม", "ขายของ", "ของขวัญ", "อื่น ๆ"];

export interface ExpenseDraft {
  date: string;
  type: ExpenseType;
  amount: string;
  category: string;
  note: string;
}

export function validateExpense(draft: ExpenseDraft, now: number, existing?: Expense): { ok: true; value: Expense } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return { ok: false, error: "กรุณาเลือกวันที่" };
  const amount = Number(draft.amount.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "จำนวนเงินต้องมากกว่า 0" };
  if (amount > MAX_AMOUNT) return { ok: false, error: "จำนวนเงินสูงเกินไป" };
  const category = draft.category.trim();
  if (!category) return { ok: false, error: "กรุณาเลือกหมวดหมู่" };
  return {
    ok: true,
    value: {
      id: existing?.id ?? createId(),
      date: draft.date,
      type: draft.type,
      amount: Math.round(amount * 100) / 100,
      category: category.slice(0, 50),
      note: draft.note.trim().slice(0, 500),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
  byCategory: { category: string; amount: number; percent: number }[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Totals for a month ("YYYY-MM"); category breakdown covers expenses only. */
export function summarizeMonth(items: readonly Expense[], month: string): MonthSummary {
  const inMonth = items.filter((e) => e.date.startsWith(month));
  const income = round2(inMonth.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0));
  const expense = round2(inMonth.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0));
  const totals = new Map<string, number>();
  for (const e of inMonth) if (e.type === "expense") totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  const byCategory = [...totals]
    .map(([category, amount]) => ({ category, amount: round2(amount), percent: expense > 0 ? Math.round((amount / expense) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { income, expense, balance: round2(income - expense), byCategory };
}

export function sortExpenses(items: readonly Expense[]): Expense[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function formatBaht(amount: number): string {
  return amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** CSV with a UTF-8 BOM so Excel shows Thai text correctly. Cells are quoted to avoid formula injection. */
export function expensesToCsv(items: readonly Expense[]): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
  const lines = [["วันที่", "ประเภท", "หมวดหมู่", "จำนวนเงิน", "หมายเหตุ"].map(quote).join(",")];
  for (const e of sortExpenses(items)) {
    lines.push([e.date, e.type === "income" ? "รายรับ" : "รายจ่าย", e.category, e.amount.toFixed(2), e.note].map(quote).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}
