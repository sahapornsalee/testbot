/** Saves bytes or a blob as a file on the user's device. */
export function downloadBlob(data: Blob | Uint8Array, fileName: string, type = "application/octet-stream"): void {
  const blob = data instanceof Blob ? data : new Blob([data.slice().buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))), type, quality));
}

export async function loadImageFile(file: Blob): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try {
    await img.decode();
    return img;
  } catch {
    URL.revokeObjectURL(img.src);
    throw new Error("เปิดรูปนี้ไม่ได้ ไฟล์อาจเสียหายหรือเป็นรูปแบบที่เบราว์เซอร์ไม่รองรับ (เช่น HEIC)");
  }
}
