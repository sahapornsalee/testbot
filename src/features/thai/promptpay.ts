/**
 * PromptPay QR payload (Thai QR Payment, EMVCo format), generated offline.
 * Any Thai banking app can scan it.
 */

export type PromptPayTarget = { kind: "phone"; value: string } | { kind: "id"; value: string } | { kind: "ewallet"; value: string };

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE as required by EMVCo QR. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Detects the target type from what the user typed. */
export function parseTarget(input: string): PromptPayTarget | null {
  const d = input.replace(/\D/g, "");
  if (/^0[689]\d{8}$/.test(d)) return { kind: "phone", value: d };
  if (/^66[689]\d{8}$/.test(d)) return { kind: "phone", value: `0${d.slice(2)}` };
  if (d.length === 13) return { kind: "id", value: d };
  if (d.length === 15) return { kind: "ewallet", value: d };
  return null;
}

export function promptPayPayload(target: PromptPayTarget, amount?: number): string {
  let account: string;
  if (target.kind === "phone") account = tlv("01", `0066${target.value.slice(1)}`.padStart(13, "0"));
  else if (target.kind === "id") account = tlv("02", target.value);
  else account = tlv("03", target.value);
  const hasAmount = amount !== undefined && amount > 0;
  const body = [
    tlv("00", "01"),
    tlv("01", hasAmount ? "12" : "11"),
    tlv("29", tlv("00", "A000000677010111") + account),
    tlv("58", "TH"),
    tlv("53", "764"),
    hasAmount ? tlv("54", amount.toFixed(2)) : "",
  ].join("");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}

export function validateAmount(text: string): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const clean = text.replace(/,/g, "").trim();
  if (clean === "") return { ok: true, value: undefined };
  const value = Number(clean);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "จำนวนเงินต้องมากกว่า 0" };
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return { ok: false, error: "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง" };
  if (value > 999_999_999.99) return { ok: false, error: "จำนวนเงินสูงเกินไป" };
  return { ok: true, value };
}
