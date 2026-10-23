import { describe, expect, it } from "vitest";
import { MESSAGES, translate } from "@/i18n/config";

function keys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("i18n", () => {
  it("has the same keys in Thai and English", () => {
    expect(keys(MESSAGES.th).sort()).toEqual(keys(MESSAGES.en).sort());
  });

  it("has no empty translations", () => {
    for (const locale of ["th", "en"] as const) {
      for (const key of keys(MESSAGES[locale])) {
        expect(translate(locale, key).trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("translates and interpolates", () => {
    expect(translate("en", "jobs.progress", { done: "1 MB", total: "2 MB" })).toBe("1 MB of 2 MB");
    expect(translate("th", "jobs.progress", { done: "1 MB", total: "2 MB" })).toBe("1 MB จาก 2 MB");
    expect(translate("th", "errors.BLOCKED_DESTINATION")).toContain("บล็อก");
  });

  it("falls back to the key for unknown entries", () => {
    expect(translate("th", "does.not.exist")).toBe("does.not.exist");
  });
});
