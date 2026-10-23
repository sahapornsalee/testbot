import { describe, expect, it } from "vitest";
import { contrastRatio, convertBase, parseColor, parseHex, parseHsl, toHex, toHsl } from "./convert";
import { diffLines } from "./diff";
import { digest } from "./hash";
import { generatePassword, passwordEntropy, strengthLabel } from "./password";
import { makeQr, qrPath, wifiPayload } from "./qr";

const opts = { length: 16, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false };

describe("password", () => {
  it("includes every selected character set", () => {
    for (let i = 0; i < 50; i++) {
      const r = generatePassword({ ...opts, length: 4 });
      if (!r.ok) throw new Error(r.error);
      expect(r.value).toMatch(/[a-z]/);
      expect(r.value).toMatch(/[A-Z]/);
      expect(r.value).toMatch(/\d/);
      expect(r.value).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it("excludes ambiguous characters and validates options", () => {
    const r = generatePassword({ ...opts, length: 128, symbols: false, excludeAmbiguous: true });
    expect(r.ok && /[0Oo1lI]/.test(r.value)).toBe(false);
    expect(generatePassword({ ...opts, lower: false, upper: false, digits: false, symbols: false }).ok).toBe(false);
    expect(generatePassword({ ...opts, length: 3 }).ok).toBe(false);
  });

  it("estimates strength", () => {
    expect(passwordEntropy({ ...opts, upper: false, symbols: false, digits: false, length: 8 })).toBe(38);
    expect(strengthLabel(38).label).toBe("อ่อนมาก");
    expect(strengthLabel(passwordEntropy(opts)).level).toBe(3);
  });
});

describe("hash", () => {
  it("matches known SHA digests", async () => {
    expect(await digest("SHA-256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await digest("SHA-1", "")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(await digest("SHA-256", "สวัสดี")).toHaveLength(64);
  });
});

describe("base conversion", () => {
  it("converts between bases including big numbers", () => {
    const r = convertBase("255", 10);
    expect(r.ok && r.values).toEqual({ 2: "11111111", 8: "377", 10: "255", 16: "FF" });
    expect(convertBase("0xff", 16).ok && (convertBase("0xff", 16) as { values: Record<number, string> }).values[10]).toBe("255");
    const big = convertBase("123456789012345678901234567890", 10);
    expect(big.ok && big.values[16]).toBe("18EE90FF6C373E0EE4E3F0AD2");
    expect(convertBase("102", 2).ok).toBe(false);
    expect(convertBase("", 10).ok).toBe(false);
  });
});

describe("colours", () => {
  it("parses and converts colours", () => {
    expect(parseHex("#2563eb")).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseHex("fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("rgb(37, 99, 235)")).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseColor("37 99 235")).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseColor("rgb(300,0,0)")).toBeNull();
    expect(toHex({ r: 37, g: 99, b: 235 })).toBe("#2563EB");
    expect(toHsl({ r: 37, g: 99, b: 235 })).toEqual({ h: 221, s: 83, l: 53 });
    expect(parseHsl("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(21);
    expect(contrastRatio(parseHex("#2563eb")!, parseHex("#ffffff")!)).toBe(5.17);
  });
});

describe("diff", () => {
  it("marks added, removed and unchanged lines", () => {
    const r = diffLines("a\nb\nc", "a\nc\nd");
    expect(r.ok && r.lines.map((l) => `${l.type[0]}:${l.text}`)).toEqual(["s:a", "r:b", "s:c", "a:d"]);
    expect(diffLines("", "x").ok && (diffLines("", "x") as { lines: unknown[] }).lines).toEqual([{ type: "added", text: "x", newLine: 1 }]);
  });

  it("limits input size", () => {
    expect(diffLines("x\n".repeat(4000), "y").ok).toBe(false);
  });
});

describe("qr", () => {
  it("encodes Thai text and grows with data", () => {
    const small = makeQr("hi");
    const thai = makeQr("สวัสดีครับ ".repeat(10));
    expect(small.ok && small.value.size).toBe(21);
    expect(thai.ok && thai.value.size).toBeGreaterThan(21);
    expect(small.ok && qrPath(small.value).startsWith("M0 0h1v1h-1z")).toBe(true);
    expect(makeQr("").ok).toBe(false);
    expect(makeQr("x".repeat(5000), "H").ok).toBe(false);
  });

  it("builds Wi-Fi payloads with escaping", () => {
    expect(wifiPayload("บ้าน;1", 'p"w', "WPA", false)).toBe(String.raw`WIFI:T:WPA;S:บ้าน\;1;P:p\"w;;`);
    expect(wifiPayload("Free", "", "nopass", true)).toBe("WIFI:T:nopass;S:Free;H:true;;");
    expect(wifiPayload(String.raw`a\b`, "x:y,z", "WPA", false)).toBe(String.raw`WIFI:T:WPA;S:a\\b;P:x\:y\,z;;`);
  });
});
