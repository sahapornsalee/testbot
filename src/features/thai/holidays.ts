import { addDays, daysInMonth, parseIsoDate, toIsoDate } from "../calendar/dates";
import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const HOLIDAYS_KEY = "productivity-hub:holidays";

export interface Holiday {
  date: string;
  name: string;
  kind: "official" | "buddhist" | "substitute" | "custom" | "private";
}

/** Fixed-date official holidays (government), month 1–12. */
const FIXED: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "วันขึ้นปีใหม่" },
  { month: 4, day: 6, name: "วันจักรี" },
  { month: 4, day: 13, name: "วันสงกรานต์" },
  { month: 4, day: 14, name: "วันสงกรานต์" },
  { month: 4, day: 15, name: "วันสงกรานต์" },
  { month: 5, day: 4, name: "วันฉัตรมงคล" },
  { month: 6, day: 3, name: "วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี" },
  { month: 7, day: 28, name: "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว" },
  { month: 8, day: 12, name: "วันแม่แห่งชาติ" },
  { month: 10, day: 13, name: "วันนวมินทรมหาราช" },
  { month: 10, day: 23, name: "วันปิยมหาราช" },
  { month: 12, day: 5, name: "วันพ่อแห่งชาติ" },
  { month: 12, day: 10, name: "วันรัฐธรรมนูญ" },
  { month: 12, day: 31, name: "วันสิ้นปี" },
];

/**
 * Buddhist holidays follow the lunar calendar, so they are listed per year.
 * Only years we are confident about are included; users can add others.
 */
export const BUDDHIST_HOLIDAYS: Record<number, { date: string; name: string }[]> = {
  2026: [
    { date: "2026-03-03", name: "วันมาฆบูชา" },
    { date: "2026-05-31", name: "วันวิสาขบูชา" },
    { date: "2026-07-29", name: "วันอาสาฬหบูชา" },
    { date: "2026-07-30", name: "วันเข้าพรรษา" },
  ],
};

export interface CustomHoliday {
  id: string;
  date: string;
  name: string;
}

export interface HolidaysData {
  version: 1;
  custom: CustomHoliday[];
}

export const EMPTY_HOLIDAYS: HolidaysData = { version: 1, custom: [] };

export function parseHolidays(raw: unknown): HolidaysData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.custom)) return null;
  const custom: CustomHoliday[] = [];
  for (const h of raw.custom.slice(0, 500)) {
    if (!isRecord(h) || typeof h.id !== "string" || typeof h.date !== "string" || typeof h.name !== "string") continue;
    if (!parseIsoDate(h.date) || !h.name.trim()) continue;
    custom.push({ id: h.id, date: h.date, name: h.name.slice(0, 100) });
  }
  return { version: 1, custom };
}

export function createCustomHoliday(date: string, name: string): CustomHoliday | null {
  if (!parseIsoDate(date) || !name.trim()) return null;
  return { id: createId(), date, name: name.trim().slice(0, 100) };
}

const isWeekend = (iso: string) => {
  const d = parseIsoDate(iso);
  if (!d) return false;
  const day = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Holidays of a year: official fixed dates, known Buddhist holidays, Labour
 * Day (private sector), substitution days for holidays falling on a weekend,
 * and the user's own entries. Sorted by date.
 */
export function holidaysOfYear(year: number, custom: readonly CustomHoliday[] = []): Holiday[] {
  const list: Holiday[] = FIXED.filter((h) => h.day <= daysInMonth(year, h.month)).map((h) => ({
    date: toIsoDate({ year, month: h.month, day: h.day }),
    name: h.name,
    kind: "official",
  }));
  for (const b of BUDDHIST_HOLIDAYS[year] ?? []) list.push({ ...b, kind: "buddhist" });
  list.push({ date: toIsoDate({ year, month: 5, day: 1 }), name: "วันแรงงานแห่งชาติ (ภาคเอกชน)", kind: "private" });
  // Substitution: a holiday on Sat/Sun moves to the next working day that is not already a holiday.
  const taken = new Set(list.filter((h) => h.kind !== "private").map((h) => h.date));
  const substitutes: Holiday[] = [];
  for (const h of [...list].filter((x) => x.kind === "official" || x.kind === "buddhist").sort((a, b) => a.date.localeCompare(b.date))) {
    if (!isWeekend(h.date)) continue;
    let day = parseIsoDate(h.date);
    if (!day) continue;
    do day = addDays(day, 1);
    while (isWeekend(toIsoDate(day)) || taken.has(toIsoDate(day)));
    taken.add(toIsoDate(day));
    substitutes.push({ date: toIsoDate(day), name: `ชดเชย${h.name}`, kind: "substitute" });
  }
  const own = custom.filter((c) => c.date.startsWith(`${year}-`)).map((c) => ({ date: c.date, name: c.name, kind: "custom" as const }));
  return [...list, ...substitutes, ...own].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

export function hasBuddhistData(year: number): boolean {
  return year in BUDDHIST_HOLIDAYS;
}
