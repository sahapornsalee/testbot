export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** RFC 9562 version 4 UUID from a cryptographically secure source. */
export function uuidV4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuids(count: number, options: { uppercase?: boolean; hyphens?: boolean } = {}): string[] {
  const n = Math.min(Math.max(Math.floor(Number.isFinite(count) ? count : 1), 1), 1000);
  return Array.from({ length: n }, () => {
    let id = uuidV4();
    if (options.hyphens === false) id = id.replace(/-/g, "");
    return options.uppercase ? id.toUpperCase() : id;
  });
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}
