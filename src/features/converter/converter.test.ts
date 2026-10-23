import { describe, expect, it } from "vitest";
import { adjustByPercent, percentChange, percentOf, whatPercent } from "./percentage";
import { CATEGORIES, convert, formatNumber, parseNumber } from "./units";

const value = (r: { ok: boolean; value?: number; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("unit conversion", () => {
  it("converts linear units", () => {
    expect(value(convert(1, "length", "km", "m"))).toBe(1000);
    expect(value(convert(12, "length", "in", "ft"))).toBe(1);
    expect(value(convert(1, "mass", "lb", "kg"))).toBe(0.45359237);
    expect(value(convert(1, "area", "rai", "sqwa"))).toBe(400);
    expect(value(convert(1, "area", "rai", "ngan"))).toBe(4);
    expect(value(convert(1, "data", "gib", "mib"))).toBe(1024);
    expect(value(convert(100, "speed", "kmh", "mps"))).toBe(27.7777777778);
    expect(value(convert(0.1, "volume", "l", "ml"))).toBe(100);
  });

  it("converts temperature", () => {
    expect(value(convert(100, "temperature", "c", "f"))).toBe(212);
    expect(value(convert(-40, "temperature", "f", "c"))).toBe(-40);
    expect(value(convert(0, "temperature", "k", "c"))).toBe(-273.15);
    expect(value(convert(37, "temperature", "c", "c"))).toBe(37);
  });

  it("rejects impossible values", () => {
    expect(convert(-300, "temperature", "c", "k").ok).toBe(false);
    expect(convert(-1, "length", "m", "cm").ok).toBe(false);
    expect(convert(Number.NaN, "length", "m", "cm").ok).toBe(false);
    expect(convert(1, "length", "m", "kg").ok).toBe(false);
    expect(convert(1, "nope", "m", "m").ok).toBe(false);
  });

  it("has unique unit ids per category", () => {
    for (const category of CATEGORIES) {
      expect(new Set(category.units.map((u) => u.id)).size).toBe(category.units.length);
    }
  });

  it("parses and formats numbers", () => {
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("-3")).toBe(-3);
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("12abc")).toBeNaN();
    expect(formatNumber(1234567.891)).toBe("1,234,567.891");
    expect(formatNumber(1e20)).toBe("1.000000e+20");
  });
});

describe("percentage", () => {
  it("computes common percentage questions", () => {
    expect(value(percentOf(15, 200))).toBe(30);
    expect(value(whatPercent(30, 200))).toBe(15);
    expect(value(percentChange(80, 100))).toBe(25);
    expect(value(percentChange(-50, -25))).toBe(50);
    expect(value(adjustByPercent(100, 7))).toBe(107);
    expect(value(adjustByPercent(1000, -20))).toBe(800);
  });

  it("rejects division by zero and invalid input", () => {
    expect(whatPercent(1, 0).ok).toBe(false);
    expect(percentChange(0, 10).ok).toBe(false);
    expect(percentOf(Number.NaN, 1).ok).toBe(false);
  });
});
