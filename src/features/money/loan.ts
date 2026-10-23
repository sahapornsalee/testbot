export interface LoanInput {
  principal: number;
  /** Annual interest rate in percent. */
  annualRate: number;
  months: number;
}

export interface LoanSummary {
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

export interface ScheduleRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export type LoanResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateLoan({ principal, annualRate, months }: LoanInput): string | null {
  if (!Number.isFinite(principal) || principal <= 0) return "ยอดเงินกู้ต้องมากกว่า 0";
  if (principal > 1e12) return "ยอดเงินกู้สูงเกินไป";
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) return "อัตราดอกเบี้ยต้องอยู่ระหว่าง 0–100%";
  if (!Number.isInteger(months) || months < 1 || months > 600) return "จำนวนงวดต้องเป็นจำนวนเต็ม 1–600 เดือน";
  return null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Reducing balance (amortized) loan, e.g. home loans: equal monthly payments. */
export function amortizedLoan(input: LoanInput): LoanResult<LoanSummary> {
  const error = validateLoan(input);
  if (error) return { ok: false, error };
  const { principal, annualRate, months } = input;
  const r = annualRate / 12 / 100;
  const payment = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  return {
    ok: true,
    value: {
      monthlyPayment: round2(payment),
      totalPaid: round2(payment * months),
      totalInterest: round2(payment * months - principal),
    },
  };
}

/** Month-by-month breakdown of an amortized loan; the last payment absorbs rounding. */
export function amortizationSchedule(input: LoanInput): LoanResult<ScheduleRow[]> {
  const summary = amortizedLoan(input);
  if (!summary.ok) return summary;
  const r = input.annualRate / 12 / 100;
  const rows: ScheduleRow[] = [];
  let balance = input.principal;
  for (let month = 1; month <= input.months; month++) {
    const interest = round2(balance * r);
    let principalPart = round2(summary.value.monthlyPayment - interest);
    if (month === input.months) principalPart = round2(balance);
    balance = round2(balance - principalPart);
    rows.push({ month, payment: round2(principalPart + interest), interest, principal: principalPart, balance: Math.max(0, balance) });
  }
  return { ok: true, value: rows };
}

/** Flat rate loan, common for Thai car and hire-purchase loans. */
export function flatRateLoan(input: LoanInput): LoanResult<LoanSummary & { effectiveRate: number }> {
  const error = validateLoan(input);
  if (error) return { ok: false, error };
  const { principal, annualRate, months } = input;
  const totalInterest = principal * (annualRate / 100) * (months / 12);
  const totalPaid = principal + totalInterest;
  // Approximate effective (reducing balance) rate for comparison.
  const effectiveRate = (annualRate * 2 * months) / (months + 1);
  return {
    ok: true,
    value: {
      monthlyPayment: round2(totalPaid / months),
      totalPaid: round2(totalPaid),
      totalInterest: round2(totalInterest),
      effectiveRate: round2(effectiveRate),
    },
  };
}
