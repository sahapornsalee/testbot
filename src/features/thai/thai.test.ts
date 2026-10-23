import { describe, expect, it } from "vitest";
import { formatThaiId, isValidThaiId, thaiIdCheckDigit } from "../../lib/thaiId";
import { createCustomHoliday, holidaysOfYear, parseHolidays } from "./holidays";
import { crc16, parseTarget, promptPayPayload, validateAmount } from "./promptpay";
import { calculateTax, progressiveTax, type TaxInput } from "./tax";

describe("Thai ID", () => {
  it("computes and validates the check digit", () => {
    expect(thaiIdCheckDigit("110370207183")).toBe(8);
    expect(isValidThaiId("1-1037-02071-83-8")).toBe(true);
    expect(isValidThaiId("1103702071830")).toBe(false);
    expect(isValidThaiId("123")).toBe(false);
    expect(formatThaiId("1103702071838")).toBe("1-1037-02071-83-8");
    expect(formatThaiId("11037")).toBe("1-1037");
  });
});

describe("PromptPay", () => {
  it("uses the standard CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("builds a phone payload without amount", () => {
    const payload = promptPayPayload({ kind: "phone", value: "0812345678" });
    expect(payload.slice(0, -4)).toBe("00020101021129370016A000000677010111011300668123456785802TH53037646304");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("builds an ID payload with amount (dynamic QR)", () => {
    const payload = promptPayPayload({ kind: "id", value: "1103702071838" }, 1500.5);
    expect(payload).toContain("010212");
    expect(payload).toContain("02131103702071838");
    expect(payload).toContain("54071500.50");
  });

  it("detects targets and validates amounts", () => {
    expect(parseTarget("081-234-5678")).toEqual({ kind: "phone", value: "0812345678" });
    expect(parseTarget("+66 81 234 5678")).toEqual({ kind: "phone", value: "0812345678" });
    expect(parseTarget("1-1037-02071-83-8")).toEqual({ kind: "id", value: "1103702071838" });
    expect(parseTarget("12345")).toBeNull();
    expect(validateAmount("")).toEqual({ ok: true, value: undefined });
    expect(validateAmount("1,234.5")).toEqual({ ok: true, value: 1234.5 });
    expect(validateAmount("1.234").ok).toBe(false);
    expect(validateAmount("-5").ok).toBe(false);
  });
});

describe("income tax", () => {
  const base: TaxInput = {
    salary: 600_000,
    withheld: 0,
    spouse: false,
    children: 0,
    childrenBornFrom2561: 0,
    parents: 0,
    socialSecurity: 9_000,
    lifeInsurance: 0,
    healthInsurance: 0,
    retirement: 0,
    homeLoanInterest: 0,
    other: 0,
  };

  it("applies the progressive rates", () => {
    expect(progressiveTax(150_000).tax).toBe(0);
    expect(progressiveTax(300_000).tax).toBe(7_500);
    expect(progressiveTax(1_000_000).tax).toBe(115_000);
    expect(progressiveTax(6_000_000).tax).toBe(1_615_000);
  });

  it("computes a typical salary case", () => {
    // 600,000 - 100,000 expenses - 60,000 personal - 9,000 SS = 431,000 net
    const r = calculateTax(base);
    expect(r.ok && r.value.netIncome).toBe(431_000);
    expect(r.ok && r.value.tax).toBe(20_600); // 7,500 + 131,000 × 10%
    const withheld = calculateTax({ ...base, withheld: 25_000 });
    expect(withheld.ok && withheld.value.balance).toBe(-4_400); // refund
  });

  it("caps allowances", () => {
    const r = calculateTax({ ...base, salary: 3_000_000, lifeInsurance: 90_000, healthInsurance: 25_000, retirement: 900_000, homeLoanInterest: 150_000, children: 2, childrenBornFrom2561: 1 });
    if (!r.ok) throw new Error(r.error);
    const amount = (label: string) => r.value.allowances.find((a) => a.label === label)?.amount;
    expect(amount("เบี้ยประกันชีวิต")).toBe(90_000);
    expect(amount("เบี้ยประกันสุขภาพ")).toBe(10_000); // life + health ≤ 100,000
    expect(amount("กองทุนเพื่อการเกษียณ (รวม)")).toBe(500_000);
    expect(amount("ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย")).toBe(100_000);
    expect(amount("บุตร")).toBe(90_000);
  });

  it("never goes below zero and rejects bad input", () => {
    expect(calculateTax({ ...base, salary: 100_000 }).ok && (calculateTax({ ...base, salary: 100_000 }) as { value: { tax: number } }).value.tax).toBe(0);
    expect(calculateTax({ ...base, salary: Number.NaN }).ok).toBe(false);
  });
});

describe("holidays", () => {
  it("lists official, Buddhist and substitution days for 2026", () => {
    const list = holidaysOfYear(2026);
    const names = (date: string) => list.filter((h) => h.date === date).map((h) => h.name);
    expect(names("2026-03-03")).toEqual(["วันมาฆบูชา"]);
    // 4 Apr... Chakri 6 Apr 2026 is a Monday: no substitute needed.
    expect(names("2026-04-06")).toEqual(["วันจักรี"]);
    // Visakha 31 May 2026 is a Sunday -> substitute on Monday 1 June.
    expect(names("2026-06-01")).toEqual(["ชดเชยวันวิสาขบูชา"]);
    // 10 Oct... 10 Dec 2026 is Thursday; 5 Dec 2026 is a Saturday -> Monday 7 Dec.
    expect(names("2026-12-07")).toEqual(["ชดเชยวันพ่อแห่งชาติ"]);
    expect(names("2026-05-01")).toEqual(["วันแรงงานแห่งชาติ (ภาคเอกชน)"]);
  });

  it("chains substitutions past other holidays", () => {
    // Songkran 2028: 13 Thu, 14 Fri, 15 Sat -> substitute Monday 17 April.
    expect(holidaysOfYear(2028).filter((h) => h.kind === "substitute" && h.date.startsWith("2028-04")).map((h) => h.date)).toEqual(["2028-04-17"]);
  });

  it("adds custom holidays and validates storage", () => {
    const own = createCustomHoliday("2027-02-20", "วันมาฆบูชา (กรอกเอง)")!;
    expect(holidaysOfYear(2027, [own]).some((h) => h.kind === "custom" && h.date === "2027-02-20")).toBe(true);
    expect(holidaysOfYear(2027).some((h) => h.kind === "buddhist")).toBe(false);
    expect(createCustomHoliday("2027-02-30", "x")).toBeNull();
    expect(parseHolidays({ version: 1, custom: [own, { id: "x", date: "bad", name: "y" }] })?.custom).toEqual([own]);
  });
});
