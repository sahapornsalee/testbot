/**
 * Password-protected notes. Encrypted in the browser with AES-GCM using a
 * key derived from the password (PBKDF2-SHA-256). The password is never
 * stored; without it the data cannot be recovered.
 */
import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const VAULT_KEY = "productivity-hub:vault";
export const PBKDF2_ITERATIONS = 310_000;
export const MIN_PASSWORD = 8;

export interface EncryptedVault {
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  body: string;
}

export class WrongPasswordError extends Error {
  constructor() {
    super("รหัสผ่านไม่ถูกต้อง");
    this.name = "WrongPasswordError";
  }
}

function toB64(bytes: Uint8Array): string {
  // Chunked so large vaults do not overflow the argument limit.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptEntries(entries: readonly VaultEntry[], password: string, iterations = PBKDF2_ITERATIONS): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(entries)));
  return { version: 1, iterations, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(data)) };
}

export async function decryptEntries(vault: EncryptedVault, password: string): Promise<VaultEntry[]> {
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(password, fromB64(vault.salt), vault.iterations);
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  } catch {
    // AES-GCM authentication fails for a wrong password or tampered data.
    throw new WrongPasswordError();
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plain));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((e): e is VaultEntry => isRecord(e) && typeof e.id === "string" && typeof e.title === "string" && typeof e.body === "string");
}

export function parseVault(raw: unknown): EncryptedVault | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const { iterations, salt, iv, data } = raw;
  if (typeof iterations !== "number" || iterations < 100_000 || iterations > 10_000_000) return null;
  if (typeof salt !== "string" || typeof iv !== "string" || typeof data !== "string") return null;
  return { version: 1, iterations, salt, iv, data };
}

export function newEntry(): VaultEntry {
  return { id: createId(), title: "", body: "" };
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัว`;
  if (password !== confirm) return "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  return null;
}
