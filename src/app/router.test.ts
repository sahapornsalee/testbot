import { describe, expect, it } from "vitest";
import { hrefFor, parseHash } from "./router";

describe("parseHash", () => {
  it("parses known routes", () => {
    expect(parseHash("")).toEqual({ name: "dashboard" });
    expect(parseHash("#/")).toEqual({ name: "dashboard" });
    expect(parseHash("#/settings")).toEqual({ name: "settings" });
    expect(parseHash("#/settings/")).toEqual({ name: "settings" });
    expect(parseHash("#/tools/calculator")).toEqual({ name: "tool", id: "calculator" });
  });

  it("returns not-found for unknown or unsafe paths", () => {
    expect(parseHash("#/nope")).toEqual({ name: "not-found", path: "/nope" });
    expect(parseHash("#/tools/<script>")).toEqual({ name: "not-found", path: "/tools/<script>" });
  });

  it("round-trips through hrefFor", () => {
    expect(parseHash(hrefFor({ name: "tool", id: "timer" }))).toEqual({ name: "tool", id: "timer" });
  });
});
