import { daysBetween, daysInMonth, diffParts, type CalendarDate } from "../calendar/dates";

const ANIMALS = ["ชวด (หนู)", "ฉลู (วัว)", "ขาล (เสือ)", "เถาะ (กระต่าย)", "มะโรง (งูใหญ่)", "มะเส็ง (งูเล็ก)", "มะเมีย (ม้า)", "มะแม (แพะ)", "วอก (ลิง)", "ระกา (ไก่)", "จอ (หมา)", "กุน (หมู)"];

/** Thai zodiac animal by Gregorian year (simplified: changes on 1 January). */
export function zodiacAnimal(year: number): string {
  return ANIMALS[(((year - 4) % 12) + 12) % 12] as string;
}

export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  daysToBirthday: number;
  nextBirthdayAge: number;
  animal: string;
}

/** Birthday in a given year; 29 Feb falls back to 28 Feb in common years. */
function birthdayIn(year: number, birth: CalendarDate): CalendarDate {
  return { year, month: birth.month, day: Math.min(birth.day, daysInMonth(year, birth.month)) };
}

export function age(birth: CalendarDate, today: CalendarDate): { ok: true; value: AgeResult } | { ok: false; error: string } {
  const totalDays = daysBetween(birth, today);
  if (totalDays < 0) return { ok: false, error: "วันเกิดต้องไม่อยู่ในอนาคต" };
  if (totalDays > 150 * 366) return { ok: false, error: "วันเกิดเก่าเกินไป" };
  const parts = diffParts(birth, today);
  let next = birthdayIn(today.year, birth);
  if (daysBetween(today, next) < 0) next = birthdayIn(today.year + 1, birth);
  return {
    ok: true,
    value: {
      ...parts,
      totalDays,
      daysToBirthday: daysBetween(today, next),
      nextBirthdayAge: next.year - birth.year,
      animal: zodiacAnimal(birth.year),
    },
  };
}
