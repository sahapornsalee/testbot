/**
 * Arithmetic expression evaluator for the calculator.
 *
 * Grammar (standard precedence, left associative):
 *   expression := term (("+" | "-") term)*
 *   term       := unary (("*" | "/") unary)*
 *   unary      := ("+" | "-") unary | postfix
 *   postfix    := primary "%"*          // "%" divides by 100
 *   primary    := number | "(" expression ")"
 *
 * Never uses eval(); input is treated as untrusted text.
 */

export type EvaluationResult = { ok: true; value: number } | { ok: false; error: CalculatorError };

export type CalculatorError =
  | "empty"
  | "invalid-character"
  | "invalid-number"
  | "unexpected-token"
  | "missing-parenthesis"
  | "division-by-zero"
  | "too-large";

export const ERROR_MESSAGES: Record<CalculatorError, string> = {
  empty: "กรุณาใส่นิพจน์",
  "invalid-character": "มีอักขระที่ไม่รองรับ",
  "invalid-number": "รูปแบบตัวเลขไม่ถูกต้อง",
  "unexpected-token": "นิพจน์ไม่สมบูรณ์",
  "missing-parenthesis": "วงเล็บไม่ครบคู่",
  "division-by-zero": "หารด้วยศูนย์ไม่ได้",
  "too-large": "ผลลัพธ์มีค่ามากเกินไป",
};

type Token = { type: "number"; value: number } | { type: "op"; value: string };

class EvaluationError extends Error {
  constructor(readonly code: CalculatorError) {
    super(code);
  }
}

const OPERATOR_ALIASES: Record<string, string> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  x: "*",
  "/": "/",
  "÷": "/",
  "%": "%",
  "(": "(",
  ")": ")",
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (/\s/.test(ch) || ch === ",") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let text = "";
      while (i < input.length && /[0-9.,]/.test(input[i] as string)) {
        if (input[i] !== ",") text += input[i];
        i++;
      }
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new EvaluationError("invalid-number");
      tokens.push({ type: "number", value: Number(text) });
      continue;
    }
    const op = OPERATOR_ALIASES[ch];
    if (!op) throw new EvaluationError("invalid-character");
    tokens.push({ type: "op", value: op });
    i++;
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expression();
    if (this.pos < this.tokens.length) {
      throw new EvaluationError(this.peekOp(")") ? "missing-parenthesis" : "unexpected-token");
    }
    return value;
  }

  private peekOp(op: string): boolean {
    const token = this.tokens[this.pos];
    return token?.type === "op" && token.value === op;
  }

  private expression(): number {
    let value = this.term();
    while (this.peekOp("+") || this.peekOp("-")) {
      const op = (this.tokens[this.pos++] as Token).value;
      const right = this.term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    while (this.peekOp("*") || this.peekOp("/")) {
      const op = (this.tokens[this.pos++] as Token).value;
      const right = this.unary();
      if (op === "/") {
        if (right === 0) throw new EvaluationError("division-by-zero");
        value /= right;
      } else {
        value *= right;
      }
    }
    return value;
  }

  private unary(): number {
    if (this.peekOp("-")) {
      this.pos++;
      return -this.unary();
    }
    if (this.peekOp("+")) {
      this.pos++;
      return this.unary();
    }
    return this.postfix();
  }

  private postfix(): number {
    let value = this.primary();
    while (this.peekOp("%")) {
      this.pos++;
      value /= 100;
    }
    return value;
  }

  private primary(): number {
    const token = this.tokens[this.pos];
    if (!token) throw new EvaluationError("unexpected-token");
    if (token.type === "number") {
      this.pos++;
      return token.value;
    }
    if (token.value === "(") {
      this.pos++;
      const value = this.expression();
      if (!this.peekOp(")")) throw new EvaluationError("missing-parenthesis");
      this.pos++;
      return value;
    }
    throw new EvaluationError("unexpected-token");
  }
}

/** Rounds away binary floating point noise, e.g. 0.1 + 0.2 -> 0.3. */
export function normalizeResult(value: number): number {
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function evaluate(input: string): EvaluationResult {
  if (input.trim() === "") return { ok: false, error: "empty" };
  try {
    const value = new Parser(tokenize(input)).parse();
    if (!Number.isFinite(value)) return { ok: false, error: "too-large" };
    return { ok: true, value: normalizeResult(value) };
  } catch (error) {
    if (error instanceof EvaluationError) return { ok: false, error: error.code };
    throw error;
  }
}

export function formatResult(value: number): string {
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-9)) {
    return value.toExponential(8).replace(/\.?0+e/, "e");
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 10, useGrouping: true });
}
