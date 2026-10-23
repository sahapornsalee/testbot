export interface BillInput {
  subtotal: number;
  discount: number;
  servicePercent: number;
  vatPercent: number;
  tip: number;
  people: number;
  roundUp: boolean;
}

export interface BillResult {
  afterDiscount: number;
  service: number;
  vat: number;
  total: number;
  perPerson: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Thai restaurant style: service charge on the discounted subtotal, then VAT
 * on subtotal + service, then tip.
 */
export function splitBill(input: BillInput): { ok: true; value: BillResult } | { ok: false; error: string } {
  const { subtotal, discount, servicePercent, vatPercent, tip, people } = input;
  const numbers = [subtotal, discount, servicePercent, vatPercent, tip];
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return { ok: false, error: "กรุณาใส่ตัวเลขที่ไม่ติดลบ" };
  if (subtotal <= 0) return { ok: false, error: "ยอดอาหารต้องมากกว่า 0" };
  if (discount > subtotal) return { ok: false, error: "ส่วนลดมากกว่ายอดอาหาร" };
  if (servicePercent > 100 || vatPercent > 100) return { ok: false, error: "เปอร์เซ็นต์ต้องไม่เกิน 100" };
  if (!Number.isInteger(people) || people < 1 || people > 1000) return { ok: false, error: "จำนวนคนต้องเป็น 1–1000" };
  const afterDiscount = subtotal - discount;
  const service = round2(afterDiscount * (servicePercent / 100));
  const vat = round2((afterDiscount + service) * (vatPercent / 100));
  const total = round2(afterDiscount + service + vat + tip);
  const exact = total / people;
  return {
    ok: true,
    value: { afterDiscount: round2(afterDiscount), service, vat, total, perPerson: input.roundUp ? Math.ceil(exact) : round2(exact) },
  };
}
