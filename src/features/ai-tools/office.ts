import { strFromU8, unzipSync, type Unzipped } from "fflate";

/**
 * Extracts readable text from Office Open XML files (.docx, .xlsx, .pptx)
 * by reading the XML inside the zip. No external service is used.
 */

export const MAX_ROWS_PER_SHEET = 2000;

function xml(files: Unzipped, path: string): Document | null {
  const bytes = files[path];
  if (!bytes) return null;
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
}

const byName = (root: Document | Element, localName: string) => Array.from(root.getElementsByTagNameNS("*", localName));
const childrenNamed = (el: Element, localName: string) => Array.from(el.children).filter((c) => c.localName === localName);

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/** Markdown table; the first row becomes the header. */
export function toMarkdownTable(rows: string[][]): string {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const padded = rows.map((r) => Array.from({ length: width }, (_, i) => escapeCell(r[i] ?? "")));
  const [head = [], ...body] = padded;
  return [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function paragraphText(p: Element): string {
  let text = "";
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === "t") text += child.textContent ?? "";
      else if (child.localName === "tab") text += "\t";
      else if (child.localName === "br" || child.localName === "cr") text += "\n";
      else if (child.localName !== "pPr" && child.localName !== "rPr") walk(child);
    }
  };
  walk(p);
  return text;
}

export function docxToText(files: Unzipped): string {
  const doc = xml(files, "word/document.xml");
  if (!doc) throw new Error("ไม่พบเนื้อหาในไฟล์ Word");
  const body = byName(doc, "body")[0];
  if (!body) return "";
  const out: string[] = [];
  for (const block of Array.from(body.children)) {
    if (block.localName === "p") {
      const text = paragraphText(block);
      const style = byName(block, "pStyle")[0]?.getAttributeNS?.(block.namespaceURI, "val") ?? byName(block, "pStyle")[0]?.getAttribute("w:val") ?? "";
      const heading = /^(heading|หัวเรื่อง)\s*(\d)/i.exec(style.replace(/([a-z])(\d)/i, "$1 $2"));
      const isList = byName(block, "numPr").length > 0;
      if (!text.trim()) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        continue;
      }
      if (heading) out.push(`${"#".repeat(Math.min(6, Number(heading[2])))} ${text.trim()}`);
      else if (isList) out.push(`- ${text.trim()}`);
      else out.push(text);
    } else if (block.localName === "tbl") {
      const rows = childrenNamed(block, "tr").map((tr) =>
        childrenNamed(tr, "tc").map((tc) => byName(tc, "p").map(paragraphText).join(" ")),
      );
      if (rows.length) out.push("", toMarkdownTable(rows), "");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** "B12" -> column index 1. */
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function relationTargets(files: Unzipped, relsPath: string, baseDir: string): Map<string, string> {
  const rels = xml(files, relsPath);
  const map = new Map<string, string>();
  if (!rels) return map;
  for (const rel of byName(rels, "Relationship")) {
    const target = rel.getAttribute("Target") ?? "";
    map.set(rel.getAttribute("Id") ?? "", target.startsWith("/") ? target.slice(1) : `${baseDir}/${target}`.replace(/[^/]+\/\.\.\//g, ""));
  }
  return map;
}

export function xlsxToText(files: Unzipped): string {
  const workbook = xml(files, "xl/workbook.xml");
  if (!workbook) throw new Error("ไม่พบข้อมูลในไฟล์ Excel");
  const shared = xml(files, "xl/sharedStrings.xml");
  const strings = shared ? byName(shared, "si").map((si) => byName(si, "t").map((t) => t.textContent ?? "").join("")) : [];
  const targets = relationTargets(files, "xl/_rels/workbook.xml.rels", "xl");
  const parts: string[] = [];
  for (const sheet of byName(workbook, "sheet")) {
    const name = sheet.getAttribute("name") ?? "Sheet";
    const rid = Array.from(sheet.attributes).find((a) => a.localName === "id" && a.prefix === "r")?.value ?? "";
    const doc = xml(files, targets.get(rid) ?? "");
    if (!doc) continue;
    const grid: string[][] = [];
    let truncated = false;
    for (const row of byName(doc, "row")) {
      const rowIndex = Number(row.getAttribute("r") ?? grid.length + 1) - 1;
      if (rowIndex >= MAX_ROWS_PER_SHEET) {
        truncated = true;
        break;
      }
      const cells = (grid[rowIndex] ??= []);
      for (const c of childrenNamed(row, "c")) {
        const type = c.getAttribute("t");
        const v = childrenNamed(c, "v")[0]?.textContent ?? "";
        let value: string;
        if (type === "s") value = strings[Number(v)] ?? "";
        else if (type === "inlineStr") value = byName(c, "t").map((t) => t.textContent ?? "").join("");
        else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
        else value = v;
        cells[columnIndex(c.getAttribute("r") ?? "A")] = value;
      }
    }
    const rows = grid.filter((r): r is string[] => Array.isArray(r)).map((r) => Array.from(r, (v) => v ?? ""));
    const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ""));
    parts.push(`## ชีต: ${name}`, nonEmpty.length ? toMarkdownTable(nonEmpty) : "(ว่าง)");
    if (truncated) parts.push(`(แสดง ${MAX_ROWS_PER_SHEET.toLocaleString()} แถวแรก)`);
    parts.push("");
  }
  return parts.join("\n").trim();
}

export function pptxToText(files: Unzipped): string {
  const slides = Object.keys(files)
    .map((path) => ({ path, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(path)?.[1]) }))
    .filter((s) => Number.isInteger(s.n))
    .sort((a, b) => a.n - b.n);
  if (slides.length === 0) throw new Error("ไม่พบสไลด์ในไฟล์ PowerPoint");
  return slides
    .map(({ path, n }) => {
      const doc = xml(files, path);
      const lines = doc ? byName(doc, "p").map((p) => byName(p, "t").map((t) => t.textContent ?? "").join("")).filter((l) => l.trim()) : [];
      return [`## สไลด์ ${n}`, ...lines].join("\n");
    })
    .join("\n\n");
}

export type OfficeKind = "docx" | "xlsx" | "pptx";

export function officeToText(kind: OfficeKind, bytes: Uint8Array): string {
  let files: Unzipped;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหาย หรือเป็นรูปแบบเก่า (.doc/.xls/.ppt) ให้บันทึกเป็น .docx/.xlsx/.pptx ก่อน");
  }
  if (kind === "docx") return docxToText(files);
  if (kind === "xlsx") return xlsxToText(files);
  return pptxToText(files);
}
