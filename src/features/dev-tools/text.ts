export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
}

/** Counts user-perceived characters and words (Thai-aware when Intl.Segmenter exists). */
export function textStats(text: string): TextStats {
  const graphemes = (s: string) =>
    typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(s)].length : [...s].length;
  let words: number;
  if (typeof Intl.Segmenter === "function") {
    words = [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].filter((s) => s.isWordLike).length;
  } else {
    words = text.split(/\s+/).filter(Boolean).length;
  }
  return {
    characters: graphemes(text),
    charactersNoSpaces: graphemes(text.replace(/\s/g, "")),
    words,
    lines: text === "" ? 0 : text.split(/\r\n|\r|\n/).length,
  };
}

export type TextTransform =
  | "upper"
  | "lower"
  | "title"
  | "trim"
  | "remove-empty-lines"
  | "dedupe-lines"
  | "sort-lines"
  | "reverse-lines"
  | "base64-encode"
  | "base64-decode"
  | "url-encode"
  | "url-decode";

export const TRANSFORMS: { id: TextTransform; label: string }[] = [
  { id: "upper", label: "ตัวพิมพ์ใหญ่" },
  { id: "lower", label: "ตัวพิมพ์เล็ก" },
  { id: "title", label: "Title Case" },
  { id: "trim", label: "ตัดช่องว่างหัวท้ายบรรทัด" },
  { id: "remove-empty-lines", label: "ลบบรรทัดว่าง" },
  { id: "dedupe-lines", label: "ลบบรรทัดซ้ำ" },
  { id: "sort-lines", label: "เรียงบรรทัด" },
  { id: "reverse-lines", label: "กลับลำดับบรรทัด" },
  { id: "base64-encode", label: "Base64 เข้ารหัส" },
  { id: "base64-decode", label: "Base64 ถอดรหัส" },
  { id: "url-encode", label: "URL เข้ารหัส" },
  { id: "url-decode", label: "URL ถอดรหัส" },
];

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(text: string): string {
  const cleaned = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const mapLines = (text: string, fn: (lines: string[]) => string[]) => fn(text.split(/\r\n|\r|\n/)).join("\n");

export function applyTransform(text: string, transform: TextTransform): { ok: true; output: string } | { ok: false; error: string } {
  try {
    switch (transform) {
      case "upper":
        return { ok: true, output: text.toUpperCase() };
      case "lower":
        return { ok: true, output: text.toLowerCase() };
      case "title":
        return { ok: true, output: text.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, ch: string) => space + ch.toUpperCase()) };
      case "trim":
        return { ok: true, output: mapLines(text, (lines) => lines.map((l) => l.trim())) };
      case "remove-empty-lines":
        return { ok: true, output: mapLines(text, (lines) => lines.filter((l) => l.trim() !== "")) };
      case "dedupe-lines":
        return { ok: true, output: mapLines(text, (lines) => [...new Set(lines)]) };
      case "sort-lines":
        return { ok: true, output: mapLines(text, (lines) => [...lines].sort((a, b) => a.localeCompare(b, "th"))) };
      case "reverse-lines":
        return { ok: true, output: mapLines(text, (lines) => [...lines].reverse()) };
      case "base64-encode":
        return { ok: true, output: encodeBase64(text) };
      case "base64-decode":
        return { ok: true, output: decodeBase64(text) };
      case "url-encode":
        return { ok: true, output: encodeURIComponent(text) };
      case "url-decode":
        return { ok: true, output: decodeURIComponent(text.replace(/\+/g, " ")) };
    }
  } catch {
    return {
      ok: false,
      error: transform === "base64-decode" ? "ข้อความไม่ใช่ Base64 ที่ถูกต้อง" : "ข้อความไม่ใช่ URL-encoded ที่ถูกต้อง",
    };
  }
}
