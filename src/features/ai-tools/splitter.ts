/** Splits long text into parts that fit an AI chat's message limit. */

export interface SplitOptions {
  maxChars: number;
  /** Adds instructions so the AI waits for all parts before answering. */
  withInstructions: boolean;
  task: string;
}

const BREAKS = ["\n\n", "\n", ". ", "? ", "! ", "。", " "];

/** Raw chunks of at most `size` characters, cut at the nicest boundary available. */
export function chunkText(text: string, size: number): string[] {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  const limit = Math.max(50, Math.floor(size));
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > limit) {
    let cut = -1;
    for (const mark of BREAKS) {
      const at = rest.lastIndexOf(mark, limit - mark.length);
      // Prefer a boundary in the second half so parts are not tiny.
      if (at >= limit * 0.5) {
        cut = at + mark.length;
        break;
      }
    }
    if (cut <= 0) cut = limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Parts ready to paste one by one, each within maxChars including its header. */
export function splitForChat(text: string, options: SplitOptions): string[] {
  const task = options.task.trim() || "สรุปเนื้อหาทั้งหมด";
  const overhead = options.withInstructions ? 260 + task.length : 40;
  const body = chunkText(text, Math.max(100, options.maxChars - overhead));
  const n = body.length;
  if (n === 0) return [];
  if (!options.withInstructions) return body.map((chunk, i) => (n > 1 ? `[ส่วนที่ ${i + 1}/${n}]\n${chunk}` : chunk));
  if (n === 1) return [`${task}\n\n"""\n${body[0]}\n"""`];
  return body.map((chunk, i) => {
    const header =
      i === 0
        ? `ฉันจะส่งเอกสารให้ทั้งหมด ${n} ส่วน กรุณาอ่านเก็บไว้และตอบเพียงว่า "รับส่วนที่ ${i + 1} แล้ว" จนกว่าจะได้รับครบทุกส่วน\n\n[ส่วนที่ ${i + 1}/${n}]`
        : i < n - 1
          ? `[ส่วนที่ ${i + 1}/${n}] (ยังไม่ต้องตอบ ตอบเพียงว่า "รับส่วนที่ ${i + 1} แล้ว")`
          : `[ส่วนที่ ${i + 1}/${n} — ส่วนสุดท้าย]`;
    const footer = i === n - 1 ? `\n\nได้รับครบ ${n} ส่วนแล้ว ตอนนี้ช่วย: ${task}` : "";
    return `${header}\n"""\n${chunk}\n"""${footer}`;
  });
}
