import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const COUNTERS_KEY = "productivity-hub:counters";
export const MAX_COUNTERS = 30;
const LIMIT = 1e9;

export interface Counter {
  id: string;
  name: string;
  value: number;
  step: number;
}

export interface CountersData {
  version: 1;
  counters: Counter[];
}

export const DEFAULT_COUNTERS: CountersData = { version: 1, counters: [{ id: "default", name: "ตัวนับ", value: 0, step: 1 }] };

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= LIMIT;

export function parseCounters(raw: unknown): CountersData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.counters)) return null;
  const counters: Counter[] = [];
  for (const c of raw.counters.slice(0, MAX_COUNTERS)) {
    if (!isRecord(c) || typeof c.id !== "string" || typeof c.name !== "string") continue;
    if (!isCount(c.value) || !isCount(c.step) || c.step < 1) continue;
    counters.push({ id: c.id, name: c.name.slice(0, 60), value: c.value, step: c.step });
  }
  return { version: 1, counters };
}

export function addCounter(data: CountersData, name: string, step = 1): CountersData {
  if (data.counters.length >= MAX_COUNTERS) return data;
  const s = Number.isInteger(step) && step >= 1 && step <= 1000 ? step : 1;
  return { ...data, counters: [...data.counters, { id: createId(), name: name.trim().slice(0, 60) || "ตัวนับ", value: 0, step: s }] };
}

export function changeCounter(data: CountersData, id: string, direction: 1 | -1): CountersData {
  return {
    ...data,
    counters: data.counters.map((c) => (c.id === id ? { ...c, value: Math.max(-LIMIT, Math.min(LIMIT, c.value + direction * c.step)) } : c)),
  };
}

export function resetCounter(data: CountersData, id: string): CountersData {
  return { ...data, counters: data.counters.map((c) => (c.id === id ? { ...c, value: 0 } : c)) };
}

export function removeCounter(data: CountersData, id: string): CountersData {
  return { ...data, counters: data.counters.filter((c) => c.id !== id) };
}
