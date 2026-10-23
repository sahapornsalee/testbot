import { describe, expect, it } from "vitest";
import { evaluate, formatResult, tokenize } from "./engine";

function value(input: string): number {
  const result = evaluate(input);
  if (!result.ok) throw new Error(`expected success for "${input}", got ${result.error}`);
  return result.value;
}

function error(input: string): string {
  const result = evaluate(input);
  if (result.ok) throw new Error(`expected error for "${input}", got ${result.value}`);
  return result.error;
}

describe("calculator engine", () => {
  it("respects operator precedence and parentheses", () => {
    expect(value("2 + 3 * 4")).toBe(14);
    expect(value("(2 + 3) * 4")).toBe(20);
    expect(value("10 - 4 - 3")).toBe(3);
    expect(value("100 / 10 / 2")).toBe(5);
    expect(value("((1 + 2) * (3 + 4))")).toBe(21);
  });

  it("handles negative numbers", () => {
    expect(value("-5 + 3")).toBe(-2);
    expect(value("3 * -2")).toBe(-6);
    expect(value("-(2 + 3)")).toBe(-5);
    expect(value("--4")).toBe(4);
  });

  it("handles decimals without floating point noise", () => {
    expect(value("0.1 + 0.2")).toBe(0.3);
    expect(value(".5 * 4")).toBe(2);
    expect(value("1.1 * 3")).toBe(3.3);
    expect(value("-0.5 + 0.5")).toBe(0);
  });

  it("treats % as divide by 100", () => {
    expect(value("50%")).toBe(0.5);
    expect(value("200 * 15%")).toBe(30);
    expect(value("-10%")).toBe(-0.1);
  });

  it("accepts display symbols and thousand separators", () => {
    expect(value("6 × 7")).toBe(42);
    expect(value("9 ÷ 3 − 1")).toBe(2);
    expect(value("1,000 + 1")).toBe(1001);
  });

  it("accepts scientific notation so large results can be reused", () => {
    expect(value("1e+20 * 2")).toBe(2e20);
    expect(value("1.5e-3 * 1000")).toBe(1.5);
    expect(error("1e")).toBe("invalid-character");
  });

  it("rejects division by zero", () => {
    expect(error("5 / 0")).toBe("division-by-zero");
    expect(error("1 / (2 - 2)")).toBe("division-by-zero");
  });

  it("rejects invalid input", () => {
    expect(error("")).toBe("empty");
    expect(error("   ")).toBe("empty");
    expect(error("2 +")).toBe("unexpected-token");
    expect(error("* 3")).toBe("unexpected-token");
    expect(error("(2 + 3")).toBe("missing-parenthesis");
    expect(error("2 + 3)")).toBe("missing-parenthesis");
    expect(error("1.2.3")).toBe("invalid-number");
    expect(error("2 ^ 3")).toBe("invalid-character");
    expect(error("alert(1)")).toBe("invalid-character");
    expect(error("2 (3)")).toBe("unexpected-token");
  });

  it("reports overflow", () => {
    expect(error("1" + "0".repeat(400) + " * 10")).toBe("too-large");
  });

  it("tokenizes numbers and operators", () => {
    expect(tokenize("12+3")).toEqual([
      { type: "number", value: 12 },
      { type: "op", value: "+" },
      { type: "number", value: 3 },
    ]);
  });
});

describe("formatResult", () => {
  it("groups thousands and limits decimals", () => {
    expect(formatResult(1234567.5)).toBe("1,234,567.5");
    expect(formatResult(-42)).toBe("-42");
    expect(formatResult(1 / 3)).toBe("0.3333333333");
  });

  it("uses exponent notation for extreme values", () => {
    expect(formatResult(1e20)).toBe("1e+20");
    expect(formatResult(1.5e-12)).toBe("1.5e-12");
  });
});
