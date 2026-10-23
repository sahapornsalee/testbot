import { round, type ConversionResult } from "./units";

/** p% of x */
export function percentOf(percent: number, value: number): ConversionResult {
  if (!Number.isFinite(percent) || !Number.isFinite(value)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  return { ok: true, value: round((percent / 100) * value) };
}

/** part is what % of whole */
export function whatPercent(part: number, whole: number): ConversionResult {
  if (!Number.isFinite(part) || !Number.isFinite(whole)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  if (whole === 0) return { ok: false, error: "ค่าทั้งหมดต้องไม่เป็นศูนย์" };
  return { ok: true, value: round((part / whole) * 100) };
}

/** % change from `from` to `to` */
export function percentChange(from: number, to: number): ConversionResult {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  if (from === 0) return { ok: false, error: "ค่าเริ่มต้นต้องไม่เป็นศูนย์" };
  return { ok: true, value: round(((to - from) / Math.abs(from)) * 100) };
}

/** value increased (positive) or decreased (negative) by percent, e.g. VAT or discount */
export function adjustByPercent(value: number, percent: number): ConversionResult {
  if (!Number.isFinite(percent) || !Number.isFinite(value)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  return { ok: true, value: round(value * (1 + percent / 100)) };
}
