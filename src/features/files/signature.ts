import { isRecord } from "../../lib/storage";

export const SIGNATURE_KEY = "productivity-hub:signature";
const MAX_DATA_URL = 600_000;

export interface SignatureData {
  version: 1;
  /** Transparent PNG as a data URL. */
  dataUrl: string;
}

export function parseSignature(raw: unknown): SignatureData | null {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.dataUrl !== "string") return null;
  if (!raw.dataUrl.startsWith("data:image/png;base64,") || raw.dataUrl.length > MAX_DATA_URL) return null;
  return { version: 1, dataUrl: raw.dataUrl };
}

/** Bounding box of non-transparent pixels, so the saved signature has no empty margin. */
export function inkBounds(data: Uint8ClampedArray, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  return Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
}
