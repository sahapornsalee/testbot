import { describe, expect, it } from "vitest";
import { zoneDisplayName } from "./clock";

describe("zoneDisplayName", () => {
  it("uses Thai names for known zones and the city part otherwise", () => {
    expect(zoneDisplayName("Asia/Bangkok")).toBe("กรุงเทพฯ");
    expect(zoneDisplayName("Europe/London")).toBe("ลอนดอน");
    expect(zoneDisplayName("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });
});
