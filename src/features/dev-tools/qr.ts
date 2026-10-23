import qrcode from "qrcode-generator";

export type QrLevel = "L" | "M" | "Q" | "H";

export interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

/** Encodes text as UTF-8 bytes so Thai and emoji scan correctly. */
export function makeQr(text: string, level: QrLevel = "M"): { ok: true; value: QrMatrix } | { ok: false; error: string } {
  if (text === "") return { ok: false, error: "กรุณาใส่ข้อความหรือลิงก์" };
  const bytes = new TextEncoder().encode(text);
  // The library reads each char code as one byte in Byte mode.
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  try {
    const qr = qrcode(0, level);
    qr.addData(binary, "Byte");
    qr.make();
    return { ok: true, value: { size: qr.getModuleCount(), isDark: (r, c) => qr.isDark(r, c) } };
  } catch {
    return { ok: false, error: "ข้อความยาวเกินกว่าที่ QR Code รองรับ ลองลดความยาวหรือเลือกระดับแก้ไขข้อผิดพลาดต่ำลง" };
  }
}

/** Wi-Fi network QR payload (WIFI: format, special characters escaped). */
export function wifiPayload(ssid: string, password: string, security: "WPA" | "WEP" | "nopass", hidden: boolean): string {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${security};S:${escape(ssid)};${security === "nopass" ? "" : `P:${escape(password)};`}${hidden ? "H:true;" : ""};`;
}

/** SVG path data drawing every dark module as a 1×1 square. */
export function qrPath(matrix: QrMatrix): string {
  let d = "";
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) if (matrix.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  return d;
}
