/** Finds and masks personal data in text before sharing it with an AI. */

import { isValidThaiId } from "../../lib/thaiId";

export { isValidThaiId };

export type PiiKind = "thai-id" | "phone" | "email" | "card" | "bank" | "custom";

export const PII_LABELS: Record<PiiKind, string> = {
  "thai-id": "เลขบัตรประชาชน",
  phone: "เบอร์โทร",
  email: "อีเมล",
  card: "เลขบัตรเครดิต",
  bank: "เลขบัญชี",
  custom: "คำที่กำหนดเอง",
};

export interface RedactOptions {
  kinds: ReadonlySet<PiiKind>;
  /** Extra words to hide, e.g. names. */
  customWords: readonly string[];
  style: "label" | "block";
}

export interface Match {
  kind: PiiKind;
  start: number;
  end: number;
  text: string;
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Luhn check used by payment cards. */
export function luhnValid(value: string): boolean {
  const d = digits(value);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

const PATTERNS: { kind: PiiKind; regex: RegExp; check?: (m: string) => boolean }[] = [
  { kind: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // 13 digits, optionally grouped 1-2345-67890-12-3; must pass the checksum.
  { kind: "thai-id", regex: /(?<!\d)\d[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d(?!\d)/g, check: isValidThaiId },
  { kind: "card", regex: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, check: luhnValid },
  // Mobile 06/08/09 and Bangkok/provincial landlines, with or without +66.
  { kind: "phone", regex: /(?<![\d+])(?:\+66[-\s]?|0)(?:[689]\d[-\s]?\d{3}[-\s]?\d{4}|[2-7][-\s]?\d{3}[-\s]?\d{4})(?!\d)/g },
  // Thai bank account style 123-4-56789-0 (10 digits, grouped) or 10–12 digits after "บัญชี".
  { kind: "bank", regex: /(?<!\d)\d{3}-\d-\d{5}-\d(?!\d)|(?<=บัญชี[^\d\n]{0,20})\d[\d-]{8,14}\d/g },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findPii(text: string, options: Pick<RedactOptions, "kinds" | "customWords">): Match[] {
  const matches: Match[] = [];
  const taken = (start: number, end: number) => matches.some((m) => start < m.end && end > m.start);
  for (const { kind, regex, check } of PATTERNS) {
    if (!options.kinds.has(kind)) continue;
    for (const m of text.matchAll(regex)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if ((check && !check(m[0])) || taken(start, end)) continue;
      matches.push({ kind, start, end, text: m[0] });
    }
  }
  if (options.kinds.has("custom")) {
    for (const word of options.customWords.map((w) => w.trim()).filter((w) => w.length >= 2)) {
      for (const m of text.matchAll(new RegExp(escapeRegExp(word), "gi"))) {
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (!taken(start, end)) matches.push({ kind: "custom", start, end, text: m[0] });
      }
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export function redact(text: string, options: RedactOptions): { text: string; matches: Match[] } {
  const matches = findPii(text, options);
  let out = "";
  let last = 0;
  for (const m of matches) {
    out += text.slice(last, m.start) + (options.style === "label" ? `[${PII_LABELS[m.kind]}]` : "█".repeat(Math.min(12, Math.max(4, m.text.length))));
    last = m.end;
  }
  return { text: out + text.slice(last), matches };
}
