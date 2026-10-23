/** Number base and colour conversions. */

export const BASES = [
  { base: 2, label: "ฐาน 2 (Binary)", pattern: /^[01]+$/ },
  { base: 8, label: "ฐาน 8 (Octal)", pattern: /^[0-7]+$/ },
  { base: 10, label: "ฐาน 10 (Decimal)", pattern: /^\d+$/ },
  { base: 16, label: "ฐาน 16 (Hex)", pattern: /^[0-9a-f]+$/i },
] as const;

/** Converts a non-negative integer of any size between bases. */
export function convertBase(input: string, from: number): { ok: true; values: Record<number, string> } | { ok: false; error: string } {
  const cleaned = input.trim().replace(/[\s_]/g, "").replace(/^(0x|0b|0o)/i, "");
  const spec = BASES.find((b) => b.base === from);
  if (!spec) return { ok: false, error: "ฐานไม่รองรับ" };
  if (cleaned === "") return { ok: false, error: "กรุณาใส่ตัวเลข" };
  if (cleaned.length > 1000) return { ok: false, error: "ตัวเลขยาวเกินไป" };
  if (!spec.pattern.test(cleaned)) return { ok: false, error: `มีตัวอักษรที่ไม่ใช่${spec.label}` };
  let value = 0n;
  const big = BigInt(from);
  for (const ch of cleaned.toLowerCase()) value = value * big + BigInt(Number.parseInt(ch, 16));
  return { ok: true, values: Object.fromEntries(BASES.map((b) => [b.base, value.toString(b.base).toUpperCase()])) };
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] as string;
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return { r: Number.parseInt(h.slice(0, 2), 16), g: Number.parseInt(h.slice(2, 4), 16), b: Number.parseInt(h.slice(4, 6), 16) };
}

export function parseRgb(text: string): Rgb | null {
  const m = /^\s*(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?\s*$/i.exec(text);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
  return [r, g, b].every((v) => v <= 255) ? { r, g, b } : null;
}

export function parseColor(text: string): Rgb | null {
  return parseHex(text) ?? parseRgb(text) ?? parseHsl(text);
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) h = (gn - bn) / delta + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function parseHsl(text: string): Rgb | null {
  const m = /^\s*hsl\s*\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?\s*\)\s*$/i.exec(text);
  if (!m) return null;
  const h = Number(m[1]) % 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  if (s > 1 || l > 1) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m0 = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r1 + m0) * 255), g: Math.round((g1 + m0) * 255), b: Math.round((b1 + m0) * 255) };
}

function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}
