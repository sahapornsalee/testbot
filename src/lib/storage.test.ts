import { describe, expect, it, vi } from "vitest";
import { isRecord, readJson, writeJson } from "./storage";

const parseNumber = (raw: unknown) => (typeof raw === "number" ? raw : null);

describe("storage", () => {
  it("returns the fallback when nothing is stored", () => {
    expect(readJson("k", parseNumber, 7)).toEqual({ value: 7, recovered: false, available: true });
  });

  it("round-trips a valid value", () => {
    expect(writeJson("k", 42)).toBe(true);
    expect(readJson("k", parseNumber, 0).value).toBe(42);
  });

  it("recovers from corrupted JSON", () => {
    localStorage.setItem("k", "{not json");
    expect(readJson("k", parseNumber, 1)).toEqual({ value: 1, recovered: true, available: true });
  });

  it("recovers from data that fails validation", () => {
    localStorage.setItem("k", JSON.stringify("text"));
    expect(readJson("k", parseNumber, 1).recovered).toBe(true);
  });

  it("reports write failures such as a full quota", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeJson("k", 1)).toBe(false);
    spy.mockRestore();
  });

  it("reports unavailable storage on read", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readJson("k", parseNumber, 3)).toEqual({ value: 3, recovered: false, available: false });
    spy.mockRestore();
  });

  it("isRecord accepts only plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
