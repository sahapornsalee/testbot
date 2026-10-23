/**
 * Thai personal income tax estimate for salary income.
 * Rates: Revenue Code progressive rates (in use since tax year 2560 / 2017).
 * Allowances: the main ones used for tax year 2568. Always check current law.
 */

export const TAX_BRACKETS: readonly { upTo: number; rate: number }[] = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

export interface TaxInput {
  /** Annual salary/wages (เงินได้ประเภทที่ 1). */
  salary: number;
  /** Tax already withheld by the employer this year. */
  withheld: number;
  spouse: boolean;
  children: number;
  /** Second and later children born from 2561 (2018) get an extra 30,000. */
  childrenBornFrom2561: number;
  parents: number;
  socialSecurity: number;
  lifeInsurance: number;
  healthInsurance: number;
  /** PVD, RMF, SSF, Thai ESG, pension insurance etc. combined. */
  retirement: number;
  homeLoanInterest: number;
  other: number;
}

export interface TaxBracketRow {
  from: number;
  to: number;
  rate: number;
  taxable: number;
  tax: number;
}

export interface TaxResult {
  expenseDeduction: number;
  allowances: { label: string; amount: number }[];
  totalAllowances: number;
  netIncome: number;
  tax: number;
  effectiveRate: number;
  brackets: TaxBracketRow[];
  /** Positive: still to pay; negative: refund. */
  balance: number;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(Number.isFinite(n) ? n : 0, max));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function progressiveTax(netIncome: number): { tax: number; brackets: TaxBracketRow[] } {
  let previous = 0;
  let tax = 0;
  const brackets: TaxBracketRow[] = [];
  for (const { upTo, rate } of TAX_BRACKETS) {
    const taxable = Math.max(0, Math.min(netIncome, upTo) - previous);
    const part = taxable * rate;
    brackets.push({ from: previous, to: upTo, rate, taxable, tax: round2(part) });
    tax += part;
    previous = upTo;
    if (netIncome <= upTo) break;
  }
  return { tax: round2(tax), brackets };
}

export function calculateTax(input: TaxInput): { ok: true; value: TaxResult } | { ok: false; error: string } {
  if (!Number.isFinite(input.salary) || input.salary < 0) return { ok: false, error: "กรุณาใส่รายได้ทั้งปี" };
  if (input.salary > 1e10) return { ok: false, error: "รายได้สูงเกินไป" };
  const children = Math.floor(clamp(input.children, 20));
  const bonusChildren = Math.floor(clamp(input.childrenBornFrom2561, Math.max(0, children - 1)));
  const life = clamp(input.lifeInsurance, 100_000);
  const health = clamp(input.healthInsurance, Math.min(25_000, 100_000 - life));
  const allowances = [
    { label: "ส่วนตัว", amount: 60_000 },
    { label: "คู่สมรส (ไม่มีรายได้)", amount: input.spouse ? 60_000 : 0 },
    { label: "บุตร", amount: children * 30_000 + bonusChildren * 30_000 },
    { label: "บิดามารดา (อายุ 60 ปีขึ้นไป)", amount: Math.floor(clamp(input.parents, 4)) * 30_000 },
    { label: "ประกันสังคม", amount: clamp(input.socialSecurity, 1e9) },
    { label: "เบี้ยประกันชีวิต", amount: life },
    { label: "เบี้ยประกันสุขภาพ", amount: health },
    { label: "กองทุนเพื่อการเกษียณ (รวม)", amount: clamp(input.retirement, 500_000) },
    { label: "ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย", amount: clamp(input.homeLoanInterest, 100_000) },
    { label: "อื่น ๆ", amount: clamp(input.other, 1e9) },
  ].filter((a) => a.amount > 0);
  const expenseDeduction = Math.min(input.salary * 0.5, 100_000);
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
  const netIncome = Math.max(0, input.salary - expenseDeduction - totalAllowances);
  const { tax, brackets } = progressiveTax(netIncome);
  return {
    ok: true,
    value: {
      expenseDeduction,
      allowances,
      totalAllowances,
      netIncome,
      tax,
      effectiveRate: input.salary > 0 ? round2((tax / input.salary) * 100) : 0,
      brackets,
      balance: round2(tax - clamp(input.withheld, 1e10)),
    },
  };
}
