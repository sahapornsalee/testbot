import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Trash2 } from "lucide-react";
import { expenseRepository, type Expense, type ExpenseType } from "../../data/models";
import { useCollection } from "../../hooks/useCollection";
import { addMonths, monthName, toIsoDate, today } from "../calendar/dates";
import { downloadText } from "../settings/backup";
import {
  EXPENSE_CATEGORIES,
  expensesToCsv,
  formatBaht,
  INCOME_CATEGORIES,
  sortExpenses,
  summarizeMonth,
  validateExpense,
  type ExpenseDraft,
} from "./expenses";
import "./money.css";

const emptyDraft = (type: ExpenseType = "expense"): ExpenseDraft => ({
  date: toIsoDate(today()),
  type,
  amount: "",
  category: type === "expense" ? (EXPENSE_CATEGORIES[0] as string) : (INCOME_CATEGORIES[0] as string),
  note: "",
});

export default function ExpensesWidget() {
  const { status, items, error, save, remove } = useCollection(expenseRepository);
  const now = today();
  const [view, setView] = useState({ year: now.year, month: now.month });
  const [draft, setDraft] = useState<ExpenseDraft>(() => emptyDraft());
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === "loading") return <p className="muted">กำลังโหลดบัญชี…</p>;
  if (status === "error") return <p className="error-text" role="alert">{error}</p>;

  const monthKey = `${view.year}-${String(view.month).padStart(2, "0")}`;
  const summary = summarizeMonth(items, monthKey);
  const list = sortExpenses(items.filter((e) => e.date.startsWith(monthKey)));
  const categories = draft.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const submit = () => {
    const result = validateExpense(draft, Date.now(), editing ?? undefined);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    save(result.value);
    setEditing(null);
    setFormError(null);
    setDraft({ ...emptyDraft(draft.type), date: draft.date });
  };

  return (
    <div className="stack">
      {error && <p className="notice" role="status">{error}</p>}
      <form
        className="stack"
        aria-label={editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="segmented" role="group" aria-label="ประเภทรายการ">
          {(["expense", "income"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={draft.type === type}
              onClick={() => setDraft((d) => ({ ...d, type, category: type === "expense" ? (EXPENSE_CATEGORIES[0] as string) : (INCOME_CATEGORIES[0] as string) }))}
            >
              {type === "expense" ? "รายจ่าย" : "รายรับ"}
            </button>
          ))}
        </div>
        <div className="field-row">
          <label className="field">
            จำนวนเงิน
            <input className="input" inputMode="decimal" placeholder="0.00" value={draft.amount} aria-invalid={formError !== null} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))} />
          </label>
          <label className="field">
            หมวดหมู่
            <select className="input" value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            วันที่
            <input className="input" type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          </label>
        </div>
        <label className="field">
          หมายเหตุ
          <input className="input" maxLength={500} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
        </label>
        {formError && (
          <p className="error-text small" role="alert">
            {formError}
          </p>
        )}
        <div className="button-row">
          <button type="submit" className="btn btn-primary">
            {editing ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setDraft(emptyDraft());
              }}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>

      <div className="calendar-header">
        <button type="button" className="icon-btn" aria-label="เดือนก่อนหน้า" onClick={() => setView((v) => addMonths(v.year, v.month, -1))}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <h3 className="calendar-title" aria-live="polite">
          {monthName(view.month)} {view.year + 543}
        </h3>
        <button type="button" className="icon-btn" aria-label="เดือนถัดไป" onClick={() => setView((v) => addMonths(v.year, v.month, 1))}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <dl className="stat-grid">
        <div>
          <dt>รายรับ</dt>
          <dd className="amount-income">{formatBaht(summary.income)}</dd>
        </div>
        <div>
          <dt>รายจ่าย</dt>
          <dd className="amount-expense">{formatBaht(summary.expense)}</dd>
        </div>
        <div>
          <dt>คงเหลือ</dt>
          <dd className={summary.balance < 0 ? "amount-expense" : undefined}>{formatBaht(summary.balance)}</dd>
        </div>
      </dl>

      {summary.byCategory.length > 0 && (
        <section className="stack" aria-label="รายจ่ายตามหมวดหมู่">
          {summary.byCategory.map((c) => (
            <div key={c.category} className="category-row">
              <span>{c.category}</span>
              <span className="muted">
                {formatBaht(c.amount)} ({c.percent}%)
              </span>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${c.percent}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {list.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีรายการในเดือนนี้</p>
      ) : (
        <ul className="expense-list" aria-label="รายการในเดือนนี้">
          {list.map((e) => (
            <li key={e.id} className="expense-item">
              <div>
                {e.category}
                <small>
                  {e.date.slice(8)}/{e.date.slice(5, 7)}
                  {e.note ? ` · ${e.note}` : ""}
                </small>
              </div>
              <strong className={e.type === "income" ? "amount-income" : "amount-expense"}>
                {e.type === "income" ? "+" : "−"}
                {formatBaht(e.amount)}
              </strong>
              <div className="task-actions">
                <button
                  type="button"
                  className="icon-btn small-btn"
                  aria-label={`แก้ไข ${e.category} ${formatBaht(e.amount)}`}
                  onClick={() => {
                    setEditing(e);
                    setDraft({ date: e.date, type: e.type, amount: String(e.amount), category: e.category, note: e.note });
                  }}
                >
                  <Pencil aria-hidden="true" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn small-btn danger"
                  aria-label={`ลบ ${e.category} ${formatBaht(e.amount)}`}
                  onClick={() => {
                    if (window.confirm(`ลบรายการ ${e.category} ${formatBaht(e.amount)} บาท?`)) remove(e.id);
                  }}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <button type="button" className="btn small" onClick={() => downloadText(expensesToCsv(items), "รายรับรายจ่าย.csv", "text/csv")}>
          <Download aria-hidden="true" size={16} /> ส่งออก CSV (เปิดใน Excel)
        </button>
      )}
    </div>
  );
}
