import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** pdf.js is large, so it is loaded only when a PDF tool is used. */
async function pdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  return lib;
}

export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  try {
    // pdf.js takes ownership of the buffer, so give it a copy.
    return await lib.getDocument({ data: bytes.slice() }).promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") throw new Error("ไฟล์ PDF นี้ตั้งรหัสผ่านไว้ ปลดรหัสก่อนแล้วลองใหม่");
    throw new Error("เปิดไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหาย");
  }
}

/** Text of every page; `hasText` is false for scanned PDFs (images only). */
export async function extractPdfText(
  bytes: Uint8Array,
  onPage?: (done: number, total: number) => void,
): Promise<{ pages: string[]; hasText: boolean }> {
  const doc = await openPdf(bytes);
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : "");
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim());
    onPage?.(n, doc.numPages);
  }
  await doc.loadingTask.destroy();
  return { pages, hasText: pages.some((p) => p.replace(/\s/g, "").length > 20) };
}

/** Renders one page (1-based) to a canvas, e.g. for OCR or a preview. */
export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้แสดงผล PDF ไม่ได้");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

export function pagesToText(pages: readonly string[]): string {
  return pages.length <= 1 ? (pages[0] ?? "") : pages.map((p, i) => `--- หน้า ${i + 1} ---\n${p}`).join("\n\n");
}
