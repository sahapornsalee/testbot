export const HASH_ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

export function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash of UTF-8 text or raw bytes using the browser's Web Crypto (works offline). */
export async function digest(algorithm: HashAlgorithm, data: string | ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) throw new Error("Web Crypto is unavailable (needs HTTPS)");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest(algorithm, bytes));
}
