import { PDFDocument } from "pdf-lib";

/**
 * Parses "1-3, 5, 8-" into zero-based page indices for a document with
 * `total` pages. Open ranges run to the last page. Order is kept.
 */
export function parsePageRanges(text: string, total: number): { ok: true; pages: number[] } | { ok: false; error: string } {
  const pages: number[] = [];
  const parts = text.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "กรุณาระบุหน้า เช่น 1-3, 5" };
  for (const part of parts) {
    const m = /^(\d*)-(\d*)$/.exec(part) ?? /^(\d+)()$/.exec(part);
    if (!m) return { ok: false, error: `ไม่เข้าใจ “${part}”` };
    const single = !part.includes("-");
    const from = m[1] ? Number(m[1]) : 1;
    const to = single ? from : m[2] ? Number(m[2]) : total;
    if (from < 1 || to > total || from > to) return { ok: false, error: `หน้า “${part}” อยู่นอกช่วง 1–${total}` };
    for (let p = from; p <= to; p++) pages.push(p - 1);
  }
  return { ok: true, pages };
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message)) throw new Error("ไฟล์ PDF นี้ตั้งรหัสผ่านไว้ ปลดรหัสก่อนแล้วลองใหม่");
    throw new Error("เปิดไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหาย");
  }
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await load(bytes)).getPageCount();
}

export async function mergePdfs(files: readonly Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const doc = await load(bytes);
    for (const page of await out.copyPages(doc, doc.getPageIndices())) out.addPage(page);
  }
  return out.save();
}

export async function extractPages(bytes: Uint8Array, indices: readonly number[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const out = await PDFDocument.create();
  for (const page of await out.copyPages(doc, [...indices])) out.addPage(page);
  return out.save();
}

export async function splitAll(bytes: Uint8Array): Promise<Uint8Array[]> {
  const doc = await load(bytes);
  return Promise.all(doc.getPageIndices().map((i) => extractPages(bytes, [i])));
}

const A4 = { width: 595.28, height: 841.89 };

/**
 * One page per image. "fit" keeps each image's own size; "a4" centres it on
 * an A4 page (portrait or landscape to match) with a margin.
 */
export async function imagesToPdf(images: readonly { bytes: Uint8Array; type: "png" | "jpg" }[], layout: "fit" | "a4"): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.type === "png" ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
    if (layout === "fit") {
      const page = out.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    } else {
      const landscape = embedded.width > embedded.height;
      const size: [number, number] = landscape ? [A4.height, A4.width] : [A4.width, A4.height];
      const page = out.addPage(size);
      const margin = 28;
      const scale = Math.min((size[0] - margin * 2) / embedded.width, (size[1] - margin * 2) / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h });
    }
  }
  return out.save();
}

/** Places a PNG (e.g. a signature) on a page. Coordinates are in PDF points from the bottom-left. */
export async function stampImage(
  bytes: Uint8Array,
  pageIndex: number,
  png: Uint8Array,
  box: { x: number; y: number; width: number; height: number },
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const page = doc.getPage(pageIndex);
  const image = await doc.embedPng(png);
  page.drawImage(image, box);
  return doc.save();
}

/**
 * Converts a box drawn on a page preview (pixels from the top-left, preview
 * rendered at `scale`) to PDF points from the bottom-left.
 */
export function previewBoxToPdf(
  box: { x: number; y: number; width: number; height: number },
  scale: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  return { x: box.x / scale, y: pageHeight - (box.y + box.height) / scale, width: box.width / scale, height: box.height / scale };
}
