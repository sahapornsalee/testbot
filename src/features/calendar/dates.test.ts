import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buddhistYear,
  daysBetween,
  daysInMonth,
  diffParts,
  monthGrid,
  monthName,
  parseIsoDate,
  toIsoDate,
  weekdayNames,
} from "./dates";

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("dates", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("parses and formats ISO dates, rejecting impossible ones", () => {
    expect(parseIsoDate("2026-10-23")).toEqual(d(2026, 10, 23));
    expect(parseIsoDate("2025-02-29")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("23/10/2026")).toBeNull();
    expect(toIsoDate(d(2026, 1, 5))).toBe("2026-01-05");
  });

  it("counts days between dates across DST-free UTC math", () => {
    expect(daysBetween(d(2026, 1, 1), d(2026, 12, 31))).toBe(364);
    expect(daysBetween(d(2024, 1, 1), d(2025, 1, 1))).toBe(366);
    expect(daysBetween(d(2026, 3, 10), d(2026, 3, 1))).toBe(-9);
  });

  it("adds days and months across boundaries", () => {
    expect(addDays(d(2026, 12, 30), 3)).toEqual(d(2027, 1, 2));
    expect(addDays(d(2024, 3, 1), -1)).toEqual(d(2024, 2, 29));
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 5, -17)).toEqual({ year: 2024, month: 12 });
  });

  it("builds a 6-week month grid", () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    // 1 Oct 2026 is a Thursday -> 4 leading days from September when weeks start on Sunday.
    expect(grid[4]).toEqual({ date: d(2026, 10, 1), inMonth: true });
    expect(grid[0]?.inMonth).toBe(false);
    expect(monthGrid(2026, 10, 1)[3]?.date).toEqual(d(2026, 10, 1));
  });

  it("splits differences into years, months and days", () => {
    expect(diffParts(d(2000, 1, 15), d(2026, 10, 23))).toEqual({ years: 26, months: 9, days: 8 });
    expect(diffParts(d(2026, 1, 31), d(2026, 3, 1))).toEqual({ years: 0, months: 1, days: 1 });
    expect(diffParts(d(2026, 5, 1), d(2026, 5, 1))).toEqual({ years: 0, months: 0, days: 0 });
    expect(diffParts(d(2026, 10, 23), d(2000, 1, 15))).toEqual({ years: 26, months: 9, days: 8 });
  });

  it("names months and weekdays in Thai", () => {
    expect(monthName(10)).toBe("ตุลาคม");
    expect(weekdayNames()[0]).toContain("อา");
    expect(weekdayNames(1)[0]).toContain("จ");
    expect(buddhistYear(2026)).toBe(2569);
  });
});
