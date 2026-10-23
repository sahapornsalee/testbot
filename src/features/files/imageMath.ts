export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export const FORMAT_EXT: Record<ImageFormat, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Fits w×h inside maxW×maxH keeping the aspect ratio; never enlarges. */
export function fitSize(w: number, h: number, maxW: number, maxH: number): { width: number; height: number } {
  const scale = Math.min(1, maxW > 0 ? maxW / w : 1, maxH > 0 ? maxH / h : 1);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Size after rotating by a multiple of 90°. */
export function rotatedSize(w: number, h: number, degrees: number): { width: number; height: number } {
  return ((degrees % 360) + 360) % 180 === 90 ? { width: h, height: w } : { width: w, height: h };
}

export function outputName(original: string, format: ImageFormat): string {
  return `${original.replace(/\.[^.]+$/, "") || "image"}-edited.${FORMAT_EXT[format]}`;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Clamps a crop rectangle to the image; null if it is too small to use. */
export function clampCrop(rect: CropRect, w: number, h: number): CropRect | null {
  const x = Math.max(0, Math.min(w, Math.round(rect.x)));
  const y = Math.max(0, Math.min(h, Math.round(rect.y)));
  const width = Math.min(w - x, Math.round(rect.width));
  const height = Math.min(h - y, Math.round(rect.height));
  return width >= 4 && height >= 4 ? { x, y, width, height } : null;
}
