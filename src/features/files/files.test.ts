import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { readExif } from "./exif";
import { clampCrop, fitSize, outputName, rotatedSize } from "./imageMath";
import { extractPages, imagesToPdf, mergePdfs, pageCount, parsePageRanges, previewBoxToPdf, splitAll, stampImage } from "./pdfOps";

/** Builds a tiny JPEG with an EXIF block (big-endian TIFF). */
function jpegWithExif(withGps: boolean): ArrayBuffer {
  const bytes: number[] = [];
  const u16 = (n: number) => bytes.push((n >> 8) & 255, n & 255);
  const tiff: number[] = [];
  const t16 = (n: number) => tiff.push((n >> 8) & 255, n & 255);
  const t32 = (n: number) => tiff.push((n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  // Header
  tiff.push(0x4d, 0x4d);
  t16(42);
  t32(8);
  // IFD0 at 8 with Make + GPS pointer
  const ifd0Count = withGps ? 2 : 1;
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  const makeOffset = 8 + ifd0Size;
  const make = "TestCam\0";
  const gpsOffset = makeOffset + make.length;
  t16(ifd0Count);
  t16(0x010f);
  t16(2);
  t32(make.length);
  t32(makeOffset);
  if (withGps) {
    t16(0x8825);
    t16(4);
    t32(1);
    t32(gpsOffset);
  }
  t32(0);
  for (const c of make) tiff.push(c.charCodeAt(0));
  if (withGps) {
    // GPS IFD: LatRef N, Lat 13°45'30", LngRef E, Lng 100°30'0"
    const entries = 4;
    const dataOffset = gpsOffset + 2 + entries * 12 + 4;
    t16(entries);
    t16(1); t16(2); t32(2); tiff.push(0x4e, 0, 0, 0);
    t16(2); t16(5); t32(3); t32(dataOffset);
    t16(3); t16(2); t32(2); tiff.push(0x45, 0, 0, 0);
    t16(4); t16(5); t32(3); t32(dataOffset + 24);
    t32(0);
    for (const [n, d] of [[13, 1], [45, 1], [30, 1], [100, 1], [30, 1], [0, 1]]) {
      t32(n as number);
      t32(d as number);
    }
  }
  u16(0xffd8);
  u16(0xffe1);
  u16(2 + 6 + tiff.length);
  for (const c of "Exif\0\0") bytes.push(c.charCodeAt(0));
  bytes.push(...tiff);
  u16(0xffd9);
  return new Uint8Array(bytes).buffer;
}

describe("EXIF", () => {
  it("reads camera make and GPS position", () => {
    expect(readExif(jpegWithExif(true))).toEqual({ make: "TestCam", gps: { lat: 13.758333, lng: 100.5 } });
  });

  it("handles photos without GPS and non-JPEG data", () => {
    expect(readExif(jpegWithExif(false))).toEqual({ make: "TestCam" });
    expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(readExif(new ArrayBuffer(0))).toBeNull();
  });
});

describe("image maths", () => {
  it("fits, rotates and names", () => {
    expect(fitSize(4000, 3000, 1600, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(800, 600, 1600, 0)).toEqual({ width: 800, height: 600 });
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, -180)).toEqual({ width: 400, height: 300 });
    expect(outputName("รูป.HEIC.png", "image/webp")).toBe("รูป.HEIC-edited.webp");
    expect(clampCrop({ x: -10, y: 5, width: 200, height: 2 }, 100, 100)).toBeNull();
    expect(clampCrop({ x: 50, y: 50, width: 200, height: 200 }, 100, 100)).toEqual({ x: 50, y: 50, width: 50, height: 50 });
  });
});

async function makePdf(pages: number, label = "p"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(label);
  for (let i = 0; i < pages; i++) doc.addPage([200 + i, 300]);
  return doc.save();
}

// 1×1 transparent PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("PDF tools", () => {
  it("parses page ranges", () => {
    expect(parsePageRanges("1-3, 5", 10)).toEqual({ ok: true, pages: [0, 1, 2, 4] });
    expect(parsePageRanges("8-", 10)).toEqual({ ok: true, pages: [7, 8, 9] });
    expect(parsePageRanges("-2", 10)).toEqual({ ok: true, pages: [0, 1] });
    expect(parsePageRanges("3 1", 10)).toEqual({ ok: true, pages: [2, 0] });
    expect(parsePageRanges("0", 10).ok).toBe(false);
    expect(parsePageRanges("4-2", 10).ok).toBe(false);
    expect(parsePageRanges("11", 10).ok).toBe(false);
    expect(parsePageRanges("abc", 10).ok).toBe(false);
    expect(parsePageRanges(" ", 10).ok).toBe(false);
  });

  it("merges, extracts and splits", async () => {
    const merged = await mergePdfs([await makePdf(2), await makePdf(3)]);
    expect(await pageCount(merged)).toBe(5);
    const extracted = await extractPages(merged, [4, 0]);
    const doc = await PDFDocument.load(extracted);
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([202, 200]);
    expect(await splitAll(await makePdf(3))).toHaveLength(3);
  });

  it("turns images into pages and stamps a signature", async () => {
    const fit = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: "png" }], "fit"));
    expect(fit.getPage(0).getSize()).toEqual({ width: 1, height: 1 });
    const a4 = await PDFDocument.load(await imagesToPdf([{ bytes: PNG, type: "png" }, { bytes: PNG, type: "png" }], "a4"));
    expect(a4.getPageCount()).toBe(2);
    expect(Math.round(a4.getPage(0).getWidth())).toBe(595);
    const stamped = await stampImage(await makePdf(1), 0, PNG, { x: 10, y: 10, width: 50, height: 20 });
    expect(stamped.length).toBeGreaterThan(0);
  });

  it("rejects broken files", async () => {
    await expect(pageCount(new Uint8Array([1, 2, 3]))).rejects.toThrow(/เปิดไฟล์ PDF ไม่ได้/);
  });

  it("maps a preview box to PDF coordinates", () => {
    expect(previewBoxToPdf({ x: 100, y: 50, width: 200, height: 100 }, 2, 800)).toEqual({ x: 50, y: 725, width: 100, height: 50 });
  });
});

describe("signature", async () => {
  const { inkBounds, parseSignature } = await import("./signature");
  it("finds the inked area and validates storage", () => {
    const data = new Uint8ClampedArray(10 * 10 * 4);
    data[(3 * 10 + 2) * 4 + 3] = 255;
    data[(6 * 10 + 7) * 4 + 3] = 255;
    expect(inkBounds(data, 10, 10)).toEqual({ x: 2, y: 3, width: 6, height: 4 });
    expect(inkBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    expect(parseSignature({ version: 1, dataUrl: "data:image/png;base64,AAAA" })).not.toBeNull();
    expect(parseSignature({ version: 1, dataUrl: "javascript:alert(1)" })).toBeNull();
  });
});
