export type Sex = "male" | "female";

export interface BmiResult {
  bmi: number;
  category: string;
  /** Healthy weight range (kg) for this height, Asian cut-offs 18.5–22.9. */
  healthyMin: number;
  healthyMax: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** BMI with the Asia-Pacific classification used by the Thai Ministry of Public Health. */
export function bmi(weightKg: number, heightCm: number): { ok: true; value: BmiResult } | { ok: false; error: string } {
  if (!Number.isFinite(weightKg) || weightKg < 2 || weightKg > 500) return { ok: false, error: "น้ำหนักต้องอยู่ระหว่าง 2–500 กก." };
  if (!Number.isFinite(heightCm) || heightCm < 40 || heightCm > 260) return { ok: false, error: "ส่วนสูงต้องอยู่ระหว่าง 40–260 ซม." };
  const m = heightCm / 100;
  const value = weightKg / (m * m);
  const category =
    value < 18.5 ? "น้ำหนักน้อย" : value < 23 ? "ปกติ (สุขภาพดี)" : value < 25 ? "ท้วม / น้ำหนักเกิน" : value < 30 ? "อ้วนระดับ 1" : "อ้วนระดับ 2";
  return { ok: true, value: { bmi: round1(value), category, healthyMin: round1(18.5 * m * m), healthyMax: round1(22.9 * m * m) } };
}

export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: "นั่งทำงาน ไม่ค่อยออกกำลังกาย" },
  { factor: 1.375, label: "ออกกำลังกายเบา 1–3 วัน/สัปดาห์" },
  { factor: 1.55, label: "ออกกำลังกายปานกลาง 3–5 วัน/สัปดาห์" },
  { factor: 1.725, label: "ออกกำลังกายหนัก 6–7 วัน/สัปดาห์" },
  { factor: 1.9, label: "ใช้แรงงานหนัก / นักกีฬา" },
] as const;

/** Basal metabolic rate (Mifflin–St Jeor) and daily energy need. */
export function energy(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  activityFactor: number,
): { ok: true; value: { bmr: number; tdee: number } } | { ok: false; error: string } {
  if (!Number.isFinite(ageYears) || ageYears < 15 || ageYears > 100) return { ok: false, error: "สูตรนี้ใช้กับอายุ 15–100 ปี" };
  const check = bmi(weightKg, heightCm);
  if (!check.ok) return check;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161);
  return { ok: true, value: { bmr: Math.round(bmr), tdee: Math.round(bmr * activityFactor) } };
}

/** Recommended water intake: about 30 ml per kg. */
export function waterLiters(weightKg: number): number {
  return Math.round(weightKg * 0.03 * 10) / 10;
}
