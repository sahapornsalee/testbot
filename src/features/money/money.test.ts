import { describe, expect, it } from "vitest";
import { bahtText, readInteger } from "./bahtText";
import { splitBill } from "./bill";
import { amortizationSchedule, amortizedLoan, flatRateLoan } from "./loan";
import { compareUnitPrices } from "./unitPrice";

const text = (n: number) => {
  const r = bahtText(n);
  if (!r.ok) throw new Error(r.error);
  return r.text;
};

describe("bahtText", () => {
  it("reads common amounts", () => {
    expect(text(0)).toBe("ศูนย์บาทถ้วน");
    expect(text(1)).toBe("หนึ่งบาทถ้วน");
    expect(text(10)).toBe("สิบบาทถ้วน");
    expect(text(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(text(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(text(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(text(120)).toBe("หนึ่งร้อยยี่สิบบาทถ้วน");
    expect(text(1234.5)).toBe("หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์");
  });

  it("handles millions like Excel BAHTTEXT", () => {
    expect(text(1_000_000)).toBe("หนึ่งล้านบาทถ้วน");
    expect(text(1_000_001)).toBe("หนึ่งล้านเอ็ดบาทถ้วน");
    expect(text(21_000_000)).toBe("ยี่สิบเอ็ดล้านบาทถ้วน");
    expect(text(1_000_000_000_000)).toBe("หนึ่งล้านล้านบาทถ้วน");
    expect(text(2_500_011)).toBe("สองล้านห้าแสนสิบเอ็ดบาทถ้วน");
  });

  it("reads satang and rounds to two decimals", () => {
    expect(text(0.5)).toBe("ห้าสิบสตางค์");
    expect(text(0.01)).toBe("หนึ่งสตางค์");
    expect(text(5.21)).toBe("ห้าบาทยี่สิบเอ็ดสตางค์");
    expect(text(1.005)).toBe("หนึ่งบาทหนึ่งสตางค์");
    expect(text(9.999)).toBe("สิบบาทถ้วน");
  });

  it("handles negatives and rejects invalid input", () => {
    expect(text(-15)).toBe("ลบสิบห้าบาทถ้วน");
    expect(bahtText(Number.NaN).ok).toBe(false);
    expect(bahtText(1e14).ok).toBe(false);
    expect(readInteger("000")).toBe("ศูนย์");
  });
});

describe("loans", () => {
  it("computes amortized payments", () => {
    const r = amortizedLoan({ principal: 1_000_000, annualRate: 6, months: 360 });
    expect(r.ok && r.value.monthlyPayment).toBe(5995.51);
    expect(r.ok && r.value.totalInterest).toBeCloseTo(1_158_381.89, 1);
    const zero = amortizedLoan({ principal: 12_000, annualRate: 0, months: 12 });
    expect(zero.ok && zero.value).toEqual({ monthlyPayment: 1000, totalPaid: 12000, totalInterest: 0 });
  });

  it("builds a schedule that pays the loan off exactly", () => {
    const r = amortizationSchedule({ principal: 10_000, annualRate: 12, months: 12 });
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toHaveLength(12);
    expect(r.value.at(-1)?.balance).toBe(0);
    const principalSum = r.value.reduce((s, row) => s + row.principal, 0);
    expect(principalSum).toBeCloseTo(10_000, 2);
    expect(r.value[0]?.interest).toBe(100);
  });

  it("computes flat-rate car loans", () => {
    const r = flatRateLoan({ principal: 500_000, annualRate: 3, months: 48 });
    expect(r.ok && r.value).toEqual({ monthlyPayment: 11666.67, totalPaid: 560000, totalInterest: 60000, effectiveRate: 5.88 });
  });

  it("validates input", () => {
    expect(amortizedLoan({ principal: 0, annualRate: 5, months: 12 }).ok).toBe(false);
    expect(amortizedLoan({ principal: 100, annualRate: -1, months: 12 }).ok).toBe(false);
    expect(amortizedLoan({ principal: 100, annualRate: 5, months: 1.5 }).ok).toBe(false);
    expect(flatRateLoan({ principal: 100, annualRate: 5, months: 601 }).ok).toBe(false);
  });
});

describe("splitBill", () => {
  const base = { subtotal: 1000, discount: 0, servicePercent: 10, vatPercent: 7, tip: 0, people: 4, roundUp: false };

  it("applies service then VAT and splits", () => {
    const r = splitBill(base);
    expect(r.ok && r.value).toEqual({ afterDiscount: 1000, service: 100, vat: 77, total: 1177, perPerson: 294.25 });
  });

  it("rounds up per person when asked and applies discount and tip", () => {
    const r = splitBill({ ...base, discount: 100, tip: 20, roundUp: true, people: 3 });
    // 900 + 90 service + 69.3 VAT + 20 tip = 1079.3 -> 359.77 -> 360
    expect(r.ok && r.value.total).toBe(1079.3);
    expect(r.ok && r.value.perPerson).toBe(360);
  });

  it("rejects invalid input", () => {
    expect(splitBill({ ...base, people: 0 }).ok).toBe(false);
    expect(splitBill({ ...base, discount: 2000 }).ok).toBe(false);
    expect(splitBill({ ...base, subtotal: -1 }).ok).toBe(false);
  });
});

describe("unit prices", () => {
  it("finds the cheapest per unit", () => {
    const rows = compareUnitPrices([
      { label: "เล็ก", price: 25, quantity: 500 },
      { label: "ใหญ่", price: 89, quantity: 2000 },
      { label: "ผิด", price: 10, quantity: 0 },
    ]);
    expect(rows.map((r) => r.cheapest)).toEqual([false, true, false]);
    expect(rows[0]?.unitPrice).toBeCloseTo(0.05);
    expect(rows[0]?.extraPercent).toBe(12.4);
    expect(rows[2]?.unitPrice).toBeNull();
  });

  it("does not mark a single valid item as cheapest", () => {
    expect(compareUnitPrices([{ label: "a", price: 1, quantity: 1 }])[0]?.cheapest).toBe(false);
  });
});
