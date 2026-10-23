/**
 * Safe LocalStorage access. Browser storage can be disabled, full, or hold
 * corrupted data, so every read is validated and every failure is reported
 * instead of thrown.
 */

export type Parser<T> = (raw: unknown) => T | null;

export interface ReadResult<T> {
  value: T;
  /** True when stored data existed but was unreadable or invalid. */
  recovered: boolean;
  available: boolean;
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, parse: Parser<T>, fallback: T): ReadResult<T> {
  const storage = getStorage();
  if (!storage) return { value: fallback, recovered: false, available: false };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { value: fallback, recovered: false, available: false };
  }
  if (raw === null) return { value: fallback, recovered: false, available: true };
  try {
    const parsed = parse(JSON.parse(raw));
    if (parsed !== null) return { value: parsed, recovered: false, available: true };
  } catch {
    // fall through to fallback
  }
  return { value: fallback, recovered: true, available: true };
}

/** Returns false when the value could not be saved. */
export function writeJson(key: string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
