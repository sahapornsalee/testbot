/**
 * Turns pixels into text an AI chat can read when image upload is blocked:
 * a character sketch of the layout, the main colours, a coarse colour map
 * and basic facts. Works on plain RGBA arrays so it is testable without a
 * canvas.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row by row (like ImageData.data). */
  data: Uint8ClampedArray;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Dark to light. Dense characters stand for dark pixels. */
export const ASCII_RAMP = "@%#*+=-:. ";

function pixelAt(img: Pixels, x: number, y: number): Rgb & { a: number } {
  const i = (Math.min(img.height - 1, Math.max(0, y)) * img.width + Math.min(img.width - 1, Math.max(0, x))) * 4;
  return { r: img.data[i] ?? 0, g: img.data[i + 1] ?? 0, b: img.data[i + 2] ?? 0, a: img.data[i + 3] ?? 255 };
}

/** Average colour of a rectangle; transparent pixels count as white. */
function averageRegion(img: Pixels, x0: number, y0: number, x1: number, y1: number): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.floor(y0); y < Math.max(Math.floor(y0) + 1, Math.floor(y1)); y++) {
    for (let x = Math.floor(x0); x < Math.max(Math.floor(x0) + 1, Math.floor(x1)); x++) {
      const p = pixelAt(img, x, y);
      const alpha = p.a / 255;
      r += p.r * alpha + 255 * (1 - alpha);
      g += p.g * alpha + 255 * (1 - alpha);
      b += p.b * alpha + 255 * (1 - alpha);
      n++;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Character sketch `columns` wide. Text characters are about twice as tall
 * as they are wide, so rows are halved to keep proportions.
 */
export function toAscii(img: Pixels, columns: number): string {
  const cols = Math.max(8, Math.min(200, Math.round(columns)));
  const cellW = img.width / cols;
  const rows = Math.max(1, Math.round((img.height / cellW) * 0.5));
  const cellH = img.height / rows;
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const lum = luminance(averageRegion(img, col * cellW, row * cellH, (col + 1) * cellW, (row + 1) * cellH));
      line += ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor((lum / 256) * ASCII_RAMP.length))];
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n");
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export interface ColorShare {
  hex: string;
  name: string;
  percent: number;
}

/** Main colours by share of the image (pixels grouped into 4 levels per channel). */
export function dominantColors(img: Pixels, count = 6): ColorShare[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt((img.width * img.height) / 40_000)));
  let total = 0;
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const p = pixelAt(img, x, y);
      if (p.a < 128) continue;
      const key = ((p.r >> 6) << 4) | ((p.g >> 6) << 2) | (p.b >> 6);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += p.r;
      bucket.g += p.g;
      bucket.b += p.b;
      bucket.n++;
      buckets.set(key, bucket);
      total++;
    }
  }
  if (total === 0) return [];
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((bucket) => {
      const rgb = { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n };
      return { hex: toHex(rgb), name: colorName(rgb), percent: Math.round((bucket.n / total) * 1000) / 10 };
    })
    .filter((c) => c.percent >= 1);
}

/** Approximate Thai colour name from hue, saturation and lightness. */
export function colorName({ r, g, b }: Rgb): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.15 || d < 0.08) {
    if (l < 0.15) return "ดำ";
    if (l < 0.4) return "เทาเข้ม";
    if (l < 0.75) return "เทา";
    if (l < 0.93) return "เทาอ่อน";
    return "ขาว";
  }
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  let h: number;
  if (max === rn) h = ((gn - bn) / d + 6) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  const name =
    h < 15 || h >= 345 ? "แดง" : h < 40 ? "ส้ม" : h < 65 ? "เหลือง" : h < 160 ? "เขียว" : h < 195 ? "ฟ้าอมเขียว" : h < 250 ? "น้ำเงิน" : h < 290 ? "ม่วง" : "ชมพู";
  // Brown is dark orange; only call it dark brown when it is very dark.
  if (name === "ส้ม" && l < 0.35) return l < 0.18 ? "น้ำตาลเข้ม" : "น้ำตาล";
  if (l < 0.3) return `${name}เข้ม`;
  // Very light red reads as pink.
  if (l > 0.78) return name === "แดง" ? "ชมพูอ่อน" : `${name}อ่อน`;
  return name;
}

/** Coarse grid of hex colours, row by row. */
export function colorGrid(img: Pixels, columns: number, rows: number): string[][] {
  const cellW = img.width / columns;
  const cellH = img.height / rows;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => toHex(averageRegion(img, col * cellW, row * cellH, (col + 1) * cellW, (row + 1) * cellH))),
  );
}

export function orientation(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.15) return "แนวนอน";
  if (ratio < 0.87) return "แนวตั้ง";
  return "จัตุรัส";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export interface PromptInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  width: number;
  height: number;
  question: string;
  ocrText: string | null;
  ocrConfidence: number | null;
  colors: ColorShare[];
  ascii: string | null;
  grid: string[][] | null;
}

/** Assembles everything into one message to paste into an AI chat. */
export function buildPrompt(input: PromptInput): string {
  const parts: string[] = [
    "ฉันแนบรูปภาพในแชทนี้ไม่ได้ จึงแปลงรูปเป็นข้อมูลข้อความด้านล่าง ช่วยวิเคราะห์ว่ารูปนี้คืออะไรจากข้อมูลเหล่านี้",
    "",
    "## ข้อมูลรูป",
    `- ไฟล์: ${input.fileName} (${input.fileType || "ไม่ทราบชนิด"}, ${formatBytes(input.fileSize)})`,
    `- ขนาด: ${input.width} × ${input.height} พิกเซล (${orientation(input.width, input.height)})`,
  ];
  if (input.colors.length > 0) {
    parts.push(`- สีหลัก: ${input.colors.map((c) => `${c.name} ${c.hex} ${c.percent}%`).join(", ")}`);
  }
  if (input.ocrText !== null) {
    parts.push("", "## ข้อความที่อ่านได้จากรูป (OCR อาจผิดบางตัว)");
    const text = input.ocrText.trim();
    parts.push(text ? `${input.ocrConfidence !== null ? `ความมั่นใจเฉลี่ย ${Math.round(input.ocrConfidence)}%\n` : ""}"""\n${text}\n"""` : "(ไม่พบข้อความในรูป)");
  }
  if (input.ascii) {
    parts.push(
      "",
      `## ภาพร่างด้วยตัวอักษร (กว้าง ${input.ascii.split("\n")[0]?.length ?? 0} ตัว; '@' = มืดที่สุด, ช่องว่าง = สว่างที่สุด)`,
      "```",
      input.ascii,
      "```",
    );
  }
  if (input.grid) {
    parts.push("", `## แผนที่สีแบบหยาบ (${input.grid[0]?.length ?? 0}×${input.grid.length} ช่อง เรียงจากซ้ายบนไปขวาล่าง)`, "```", ...input.grid.map((row) => row.join(" ")), "```");
  }
  const question = input.question.trim();
  parts.push("", "## คำถาม", question || "รูปนี้คืออะไร อธิบายสิ่งที่น่าจะอยู่ในรูป");
  return parts.join("\n");
}

/**
 * Tidies OCR output: Thai has no spaces between words, but the Thai model
 * often emits a single space between characters, which is removed. Wider
 * gaps are kept as one space. Also trims blank lines.
 */
export function cleanOcrText(text: string): string {
  return text
    // Tesseract writes sara am (ำ) as nikhahit + sara aa (ํา).
    .replace(/ํา/g, "ำ")
    .replace(/(?<=[฀-๿]) (?=[฀-๿])/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
