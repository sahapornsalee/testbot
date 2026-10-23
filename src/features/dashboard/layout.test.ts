import { describe, expect, it } from "vitest";
import {
  addWidget,
  createDefaultLayout,
  migrateLegacyFavorites,
  moveWidget,
  parseLayout,
  removeWidget,
  fillRows,
  resolveColumns,
  setWidgetHidden,
  setWidgetSize,
  spanFor,
  toggleWidget,
  type WidgetInfo,
} from "./layout";

const widgets: WidgetInfo[] = [
  { id: "clock", defaultSize: "small", supportsResize: false },
  { id: "calculator", defaultSize: "medium", supportsResize: true },
  { id: "timer", defaultSize: "medium", supportsResize: true },
];
const byId = (id: string) => widgets.find((w) => w.id === id) as WidgetInfo;
const base = createDefaultLayout(widgets, ["clock", "calculator", "timer"]);
const ids = (layout: { items: { id: string }[] }) => layout.items.map((i) => i.id);

describe("parseLayout", () => {
  it("accepts a valid layout", () => {
    expect(parseLayout(base, widgets)).toEqual(base);
  });

  it("drops unknown ids, duplicates and malformed entries", () => {
    const parsed = parseLayout(
      { version: 2, columns: 3, items: [{ id: "gone" }, { id: "timer" }, { id: "timer" }, 5, { id: 1 }] },
      widgets,
    );
    expect(parsed).toEqual({ version: 2, columns: 3, items: [{ id: "timer", size: "medium", hidden: false }] });
  });

  it("falls back to default sizes and auto columns for invalid values", () => {
    const parsed = parseLayout(
      { version: 2, columns: 9, items: [{ id: "clock", size: "large" }, { id: "timer", size: "huge", hidden: "yes" }] },
      widgets,
    );
    expect(parsed?.columns).toBe("auto");
    expect(parsed?.items).toEqual([
      { id: "clock", size: "small", hidden: false },
      { id: "timer", size: "medium", hidden: false },
    ]);
  });

  it("rejects corrupted data", () => {
    expect(parseLayout(null, widgets)).toBeNull();
    expect(parseLayout({ version: 1, items: [] }, widgets)).toBeNull();
    expect(parseLayout({ version: 2, items: "x" }, widgets)).toBeNull();
  });
});

describe("migrateLegacyFavorites", () => {
  it("converts the v0.1.0 favorites format", () => {
    expect(ids(migrateLegacyFavorites({ version: 1, ids: ["timer", "gone", "timer", "clock"] }, widgets)!)).toEqual([
      "timer",
      "clock",
    ]);
  });

  it("rejects other shapes", () => {
    expect(migrateLegacyFavorites({ version: 2, ids: [] }, widgets)).toBeNull();
  });
});

describe("layout operations", () => {
  it("adds, removes and toggles widgets", () => {
    const without = removeWidget(base, "clock");
    expect(ids(without)).toEqual(["calculator", "timer"]);
    expect(ids(addWidget(without, byId("clock")))).toEqual(["calculator", "timer", "clock"]);
    expect(addWidget(base, byId("clock"))).toBe(base);
    expect(ids(toggleWidget(base, byId("timer")))).toEqual(["clock", "calculator"]);
  });

  it("moves widgets and clamps the target index", () => {
    expect(ids(moveWidget(base, "clock", 2))).toEqual(["calculator", "timer", "clock"]);
    expect(ids(moveWidget(base, "timer", -5))).toEqual(["timer", "clock", "calculator"]);
    expect(moveWidget(base, "missing", 0)).toBe(base);
  });

  it("resizes only resizable widgets", () => {
    expect(setWidgetSize(base, byId("calculator"), "large").items[1]?.size).toBe("large");
    expect(setWidgetSize(base, byId("clock"), "large")).toBe(base);
  });

  it("hides and shows widgets", () => {
    const hidden = setWidgetHidden(base, "timer", true);
    expect(hidden.items[2]?.hidden).toBe(true);
    expect(setWidgetHidden(hidden, "timer", false).items[2]?.hidden).toBe(false);
  });
});

describe("columns", () => {
  it("uses one column on phones and caps by the user setting", () => {
    expect(resolveColumns(390, "auto")).toBe(1);
    expect(resolveColumns(390, 4)).toBe(1);
    expect(resolveColumns(900, "auto")).toBe(2);
    expect(resolveColumns(1200, "auto")).toBe(3);
    expect(resolveColumns(1600, 2)).toBe(2);
  });

  it("never spans more columns than exist", () => {
    expect(spanFor("large", 2)).toBe(2);
    expect(spanFor("medium", 3)).toBe(2);
    expect(spanFor("small", 1)).toBe(1);
  });
});

describe("fillRows", () => {
  it("leaves rows that are already full unchanged", () => {
    expect(fillRows([1, 1, 2], 4)).toEqual([1, 1, 2]);
  });

  it("widens the narrowest cards so each row is full, keeping order", () => {
    // [calendar 2, timer 1] cannot take notes (3), so the row is filled.
    expect(fillRows([1, 1, 2, 2, 1, 3], 4)).toEqual([1, 1, 2, 2, 2, 4]);
  });

  it("spreads leftover columns across small cards", () => {
    expect(fillRows([1, 1], 4)).toEqual([2, 2]);
    expect(fillRows([1, 1, 1], 4)).toEqual([2, 1, 1]);
  });

  it("caps spans to the column count and handles one column", () => {
    expect(fillRows([3, 2], 2)).toEqual([2, 2]);
    expect(fillRows([1, 2, 3], 1)).toEqual([1, 1, 1]);
    expect(fillRows([], 3)).toEqual([]);
  });
});
