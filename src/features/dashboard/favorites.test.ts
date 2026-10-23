import { describe, expect, it } from "vitest";
import { parseFavorites, toggleFavorite } from "./favorites";

const known = new Set(["clock", "calculator", "timer"]);

describe("parseFavorites", () => {
  it("keeps known ids in order and removes duplicates", () => {
    expect(parseFavorites({ version: 1, ids: ["timer", "clock", "timer"] }, known)).toEqual({
      version: 1,
      ids: ["timer", "clock"],
    });
  });

  it("drops ids that are not in the registry or not strings", () => {
    expect(parseFavorites({ version: 1, ids: ["removed-tool", 3, "clock"] }, known)?.ids).toEqual([
      "clock",
    ]);
  });

  it("rejects malformed data", () => {
    expect(parseFavorites(["clock"], known)).toBeNull();
    expect(parseFavorites({ version: 2, ids: [] }, known)).toBeNull();
    expect(parseFavorites({ version: 1, ids: "clock" }, known)).toBeNull();
  });
});

describe("toggleFavorite", () => {
  it("adds and removes an id", () => {
    const added = toggleFavorite({ version: 1, ids: ["clock"] }, "timer");
    expect(added.ids).toEqual(["clock", "timer"]);
    expect(toggleFavorite(added, "clock").ids).toEqual(["timer"]);
  });
});
