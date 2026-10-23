import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings, resolveTheme } from "./settings";

describe("parseSettings", () => {
  it("accepts valid settings", () => {
    expect(parseSettings({ version: 1, theme: "dark", timeFormat: "12h" })).toEqual({
      version: 1,
      theme: "dark",
      timeFormat: "12h",
    });
  });

  it("replaces invalid fields with defaults", () => {
    expect(parseSettings({ version: 1, theme: "neon", timeFormat: 5 })).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects unknown versions and non-objects", () => {
    expect(parseSettings({ version: 99 })).toBeNull();
    expect(parseSettings("dark")).toBeNull();
    expect(parseSettings(null)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("follows the system preference only in system mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
