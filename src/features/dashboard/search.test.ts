import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, WIDGETS } from "../../app/registry";
import { searchWidgets } from "./search";

const ids = (query: string) => searchWidgets(WIDGETS, query, CATEGORY_LABELS).map((w) => w.id);

describe("searchWidgets", () => {
  it("returns every tool for an empty query", () => {
    expect(ids("  ")).toEqual(WIDGETS.map((w) => w.id));
  });

  it("matches Thai titles", () => {
    expect(ids("คิดเลข")).toEqual(["calculator"]);
  });

  it("matches English keywords case-insensitively", () => {
    expect(ids("STOPWATCH")).toEqual(["timer"]);
  });

  it("matches category labels", () => {
    expect(ids("เวลาและปฏิทิน").sort()).toEqual(["age", "calendar", "clock", "events", "pomodoro", "timer", "world-clock"]);
  });

  it("requires every term to match", () => {
    expect(ids("เวลา countdown").sort()).toEqual(["events", "timer"]);
    expect(ids("calculator countdown")).toEqual([]);
  });

  it("returns nothing for unknown terms", () => {
    expect(ids("spreadsheet")).toEqual([]);
  });
});
