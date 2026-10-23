import { describe, expect, it } from "vitest";
import { formatLongDate, formatTime, formatUtcOffset } from "./clock";

// 2026-10-23 14:05:09 UTC
const date = new Date(Date.UTC(2026, 9, 23, 14, 5, 9));

describe("clock formatting", () => {
  it("formats 24-hour time", () => {
    expect(formatTime(date, "24h", "UTC")).toBe("14:05:09");
  });

  it("formats 12-hour time with a period marker", () => {
    const text = formatTime(date, "12h", "UTC");
    expect(text).toMatch(/02:05:09/);
    expect(text).not.toMatch(/14/);
  });

  it("respects the time zone", () => {
    expect(formatTime(date, "24h", "Asia/Bangkok")).toBe("21:05:09");
  });

  it("formats a Thai long date", () => {
    const text = formatLongDate(date, "UTC");
    expect(text).toContain("ตุลาคม");
    expect(text).toContain("23");
    expect(text).toContain("ศุกร์");
  });

  it("formats UTC offsets", () => {
    expect(formatUtcOffset(420)).toBe("UTC+07:00");
    expect(formatUtcOffset(-210)).toBe("UTC-03:30");
    expect(formatUtcOffset(0)).toBe("UTC+00:00");
  });
});
