export const MAX_JSON_INPUT = 5_000_000;

export type JsonResult = { ok: true; output: string } | { ok: false; error: string; line?: number; column?: number };

export function lineColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

/**
 * Finds the offset of the first JSON syntax error. Used because some engines
 * (current Chrome) no longer include a position in JSON.parse messages.
 */
export function findJsonErrorOffset(text: string): number {
  let i = 0;
  const fail = (): never => {
    throw i;
  };
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i] as string)) i++;
  };
  const literal = (word: string) => {
    for (const ch of word) {
      if (text[i] !== ch) fail();
      i++;
    }
  };
  const string = () => {
    i++; // opening quote
    while (i < text.length) {
      const ch = text[i] as string;
      if (ch === '"') {
        i++;
        return;
      }
      if (ch.charCodeAt(0) < 0x20) fail();
      if (ch === "\\") {
        i++;
        const esc = text[i];
        if (esc === "u") {
          for (let k = 0; k < 4; k++) if (!/[0-9a-fA-F]/.test(text[++i] ?? "")) fail();
        } else if (!esc || !'"\\/bfnrt'.includes(esc)) fail();
      }
      i++;
    }
    fail();
  };
  const number = () => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match || match[0] === "" || match[0] === "-") fail();
    i += (match as RegExpExecArray)[0].length;
  };
  const value = (): void => {
    ws();
    const ch = text[i];
    if (ch === "{") {
      i++;
      ws();
      if (text[i] === "}") {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        string();
        ws();
        if (text[i] !== ":") fail();
        i++;
        value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return;
        }
        fail();
      }
    }
    if (ch === "[") {
      i++;
      ws();
      if (text[i] === "]") {
        i++;
        return;
      }
      for (;;) {
        value();
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return;
        }
        fail();
      }
    }
    if (ch === '"') return string();
    if (ch === "t") return literal("true");
    if (ch === "f") return literal("false");
    if (ch === "n") return literal("null");
    if (ch === "-" || (ch !== undefined && ch >= "0" && ch <= "9")) return number();
    fail();
  };
  try {
    value();
    ws();
    if (i < text.length) fail();
    return -1;
  } catch (offset) {
    return Math.min(typeof offset === "number" ? offset : 0, text.length);
  }
}

function parseError(text: string, error: unknown): JsonResult {
  const offset = findJsonErrorOffset(text);
  if (offset >= 0) {
    const { line, column } = lineColumn(text, offset);
    return { ok: false, error: `JSON ไม่ถูกต้องที่บรรทัด ${line} คอลัมน์ ${column}`, line, column };
  }
  const message = error instanceof Error ? error.message : String(error);
  const position = /position (\d+)/.exec(message);
  if (position) {
    const { line, column } = lineColumn(text, Number(position[1]));
    return { ok: false, error: `JSON ไม่ถูกต้องที่บรรทัด ${line} คอลัมน์ ${column}`, line, column };
  }
  const lineCol = /line (\d+) column (\d+)/.exec(message);
  if (lineCol) {
    const line = Number(lineCol[1]);
    const column = Number(lineCol[2]);
    return { ok: false, error: `JSON ไม่ถูกต้องที่บรรทัด ${line} คอลัมน์ ${column}`, line, column };
  }
  return { ok: false, error: "JSON ไม่ถูกต้อง" };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function transformJson(text: string, mode: "format" | "minify", options: { indent?: number | "\t"; sortKeys?: boolean } = {}): JsonResult {
  if (text.trim() === "") return { ok: false, error: "กรุณาวาง JSON" };
  if (text.length > MAX_JSON_INPUT) return { ok: false, error: "ข้อมูลใหญ่เกิน 5 MB" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return parseError(text, error);
  }
  if (options.sortKeys) value = sortKeysDeep(value);
  return { ok: true, output: mode === "minify" ? JSON.stringify(value) : JSON.stringify(value, null, options.indent ?? 2) };
}
