import { describe, expect, it } from "vitest";
import {
  displayYear,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatTime,
  formatUtcOffset,
  fromDisplayYear,
  isValidZone,
  monthName,
  todayIn,
  weekdayNames,
  zoneOffsetMinutes,
} from "./datetime";

const thai = { locale: "th" as const, timeZone: "Asia/Bangkok" };
const uk = { locale: "en-GB" as const, timeZone: "Europe/London" };
// 23 Oct 2026 20:30 UTC = 24 Oct 03:30 in Bangkok, 21:30 in London (BST).
const instant = new Date(Date.UTC(2026, 9, 23, 20, 30, 15));

describe("datetime", () => {
  it("uses the configured zone for today, not the device", () => {
    expect(todayIn("Asia/Bangkok", instant)).toEqual({ year: 2026, month: 10, day: 24 });
    expect(todayIn("Europe/London", instant)).toEqual({ year: 2026, month: 10, day: 23 });
  });

  it("formats times in the configured zone", () => {
    expect(formatTime(instant, thai, false)).toBe("03:30:15");
    expect(formatTime(instant, uk, false)).toBe("21:30:15");
    expect(formatTime(instant, uk, true, false)).toMatch(/09:30\s?pm/i);
  });

  it("formats Thai dates in the Buddhist era and UK dates in the Common era", () => {
    expect(formatDate({ year: 2026, month: 10, day: 23 }, "th")).toBe("วันศุกร์ที่ 23 ตุลาคม พ.ศ. 2569");
    expect(formatDate({ year: 2026, month: 10, day: 23 }, "en-GB")).toMatch(/^Friday,? 23 October 2026$/);
    expect(formatDate({ year: 2026, month: 10, day: 23 }, "en-GB", "short")).toBe("23/10/2026");
    expect(formatDate({ year: 2026, month: 10, day: 23 }, "th", "short")).toBe("23/10/69");
    expect(formatLongDate(instant, thai)).toContain("2569");
    expect(formatLongDate(instant, uk)).toMatch(/^Friday,? 23 October 2026$/);
    expect(formatDateTime(instant.getTime(), uk)).toBe("23 Oct 2026, 21:30");
  });

  it("names months and weekdays", () => {
    expect(monthName(10, "th")).toBe("ตุลาคม");
    expect(monthName(10, "en-GB")).toBe("October");
    expect(weekdayNames("en-GB")).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(weekdayNames("th")).toEqual(["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]);
    expect(weekdayNames("th", 1)[0]).toBe("จ.");
  });

  it("converts display years", () => {
    expect(displayYear(2026, "th")).toBe(2569);
    expect(displayYear(2026, "en-GB")).toBe(2026);
    expect(fromDisplayYear(2569, "th")).toBe(2026);
  });

  it("computes offsets and validates zones", () => {
    expect(zoneOffsetMinutes("Asia/Bangkok", instant)).toBe(420);
    expect(zoneOffsetMinutes("Europe/London", instant)).toBe(60);
    expect(zoneOffsetMinutes("Europe/London", new Date(Date.UTC(2026, 0, 1)))).toBe(0);
    expect(formatUtcOffset(420)).toBe("UTC+07:00");
    expect(formatUtcOffset(-210)).toBe("UTC-03:30");
    expect(isValidZone("Europe/London")).toBe(true);
    expect(isValidZone("Nowhere/City")).toBe(false);
  });
});
