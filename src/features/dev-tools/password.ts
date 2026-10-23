import { randomInt, shuffle } from "../../lib/random";

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leave out characters that look alike: 0 O o 1 l I | */
  excludeAmbiguous: boolean;
}

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
};
const AMBIGUOUS = /[0Oo1lI|]/g;

export function generatePassword(options: PasswordOptions): { ok: true; value: string } | { ok: false; error: string } {
  if (!Number.isInteger(options.length) || options.length < 4 || options.length > 128) return { ok: false, error: "ความยาวต้องเป็น 4–128 ตัว" };
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((key) => options[key])
    .map((key) => (options.excludeAmbiguous ? SETS[key].replace(AMBIGUOUS, "") : SETS[key]));
  if (sets.length === 0) return { ok: false, error: "เลือกชนิดตัวอักษรอย่างน้อย 1 แบบ" };
  if (options.length < sets.length) return { ok: false, error: "ความยาวน้อยกว่าจำนวนชนิดตัวอักษรที่เลือก" };
  const all = sets.join("");
  // One character from every chosen set, the rest from all, then shuffle.
  const chars = sets.map((set) => set[randomInt(set.length)] as string);
  while (chars.length < options.length) chars.push(all[randomInt(all.length)] as string);
  return { ok: true, value: shuffle(chars).join("") };
}

/** Entropy in bits assuming uniformly random characters from the pool. */
export function passwordEntropy(options: PasswordOptions): number {
  const pool = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((key) => options[key])
    .reduce((n, key) => n + (options.excludeAmbiguous ? SETS[key].replace(AMBIGUOUS, "") : SETS[key]).length, 0);
  return pool > 1 ? Math.round(options.length * Math.log2(pool)) : 0;
}

export function strengthLabel(bits: number): { label: string; level: 0 | 1 | 2 | 3 } {
  if (bits < 40) return { label: "อ่อนมาก", level: 0 };
  if (bits < 60) return { label: "พอใช้", level: 1 };
  if (bits < 80) return { label: "แข็งแรง", level: 2 };
  return { label: "แข็งแรงมาก", level: 3 };
}
