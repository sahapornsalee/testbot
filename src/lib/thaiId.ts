const digitsOnly = (s: string) => s.replace(/\D/g, "");

/** Check digit for the first 12 digits of a Thai national ID. */
export function thaiIdCheckDigit(first12: string): number {
  const d = digitsOnly(first12);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10;
}

export function isValidThaiId(value: string): boolean {
  const d = digitsOnly(value);
  return d.length === 13 && thaiIdCheckDigit(d.slice(0, 12)) === Number(d[12]);
}

/** 1-2345-67890-12-3 */
export function formatThaiId(value: string): string {
  const d = digitsOnly(value).slice(0, 13);
  const parts = [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)];
  return parts.filter(Boolean).join("-");
}

/** Meaning of the first digit (person type), per the Department of Provincial Administration. */
export const THAI_ID_TYPES: Record<string, string> = {
  "1": "คนไทยที่เกิดและแจ้งเกิดภายในกำหนด (ตั้งแต่ปี 2527)",
  "2": "คนไทยที่เกิดแต่แจ้งเกิดเกินกำหนด (ตั้งแต่ปี 2527)",
  "3": "คนไทยหรือคนต่างด้าวที่มีชื่อในทะเบียนบ้านก่อนปี 2527",
  "4": "คนไทยหรือคนต่างด้าวที่ย้ายเข้าทะเบียนบ้านโดยยังไม่มีเลขประจำตัว (ก่อนปี 2527)",
  "5": "คนไทยที่ได้รับอนุมัติให้เพิ่มชื่อเข้าทะเบียนบ้านภายหลัง",
  "6": "ผู้ที่เข้าเมืองโดยไม่ชอบด้วยกฎหมาย หรือเข้าเมืองชั่วคราว",
  "7": "บุตรของบุคคลประเภทที่ 6 ที่เกิดในประเทศไทย",
  "8": "คนต่างด้าวที่ได้รับอนุญาตให้อยู่ถาวร หรือได้สัญชาติไทย (ตั้งแต่ปี 2527)",
};
