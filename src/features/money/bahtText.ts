/** Reads an amount as Thai words, matching the conventions of Excel's BAHTTEXT. */

const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

export const MAX_BAHT_TEXT = 1e13;

/** Reads up to six digits. `alwaysEd` uses "เอ็ด" for a lone 1 that follows a higher group. */
function readGroup(digits: string, alwaysEd: boolean): string {
  let text = "";
  const length = digits.length;
  const hasHigherDigits = /[1-9]/.test(digits.slice(0, -1));
  for (let i = 0; i < length; i++) {
    const digit = Number(digits[i]);
    const position = length - i - 1;
    if (digit === 0) continue;
    if (position === 1 && digit === 1) text += "สิบ";
    else if (position === 1 && digit === 2) text += "ยี่สิบ";
    else if (position === 0 && digit === 1 && (hasHigherDigits || alwaysEd)) text += "เอ็ด";
    else text += DIGITS[digit] + (POSITIONS[position] ?? "");
  }
  return text;
}

/** Reads a non-negative integer (as a digit string) in Thai, grouping by ล้าน. */
export function readInteger(digits: string): string {
  const clean = digits.replace(/^0+/, "");
  if (clean === "") return "ศูนย์";
  const groups: string[] = [];
  for (let end = clean.length; end > 0; end -= 6) groups.unshift(clean.slice(Math.max(0, end - 6), end));
  return groups
    .map((group, index) => {
      const words = readGroup(group, index > 0);
      const isLast = index === groups.length - 1;
      return words + (isLast ? "" : "ล้าน");
    })
    .join("");
}

export type BahtTextResult = { ok: true; text: string } | { ok: false; error: string };

export function bahtText(amount: number): BahtTextResult {
  if (!Number.isFinite(amount)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  if (Math.abs(amount) >= MAX_BAHT_TEXT) return { ok: false, error: "รองรับไม่เกิน 9,999,999,999,999.99" };
  const negative = amount < 0;
  const totalSatang = Math.round((Math.abs(amount) + Number.EPSILON) * 100);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;
  let text = "";
  if (baht > 0) text += `${readInteger(String(baht))}บาท`;
  if (satang === 0) text += baht === 0 ? "ศูนย์บาทถ้วน" : "ถ้วน";
  else text += `${readInteger(String(satang))}สตางค์`;
  if (negative && totalSatang > 0) text = `ลบ${text}`;
  return { ok: true, text };
}
