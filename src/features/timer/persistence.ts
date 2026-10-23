import { isRecord } from "../../lib/storage";
import { clampDuration, type CountdownState, type StopwatchState } from "./timer";

export const STOPWATCH_KEY = "productivity-hub:timer:stopwatch";
export const COUNTDOWN_KEY = "productivity-hub:timer:countdown";
export const TIMER_KEYS = [STOPWATCH_KEY, COUNTDOWN_KEY];

const isTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Restores a stopwatch; because state is timestamp based it keeps running across reloads. */
export function parseStopwatch(raw: unknown): StopwatchState | null {
  if (!isRecord(raw)) return null;
  const { status, startedAt, accumulatedMs, laps } = raw;
  if (status !== "idle" && status !== "running" && status !== "paused") return null;
  if (!isTime(accumulatedMs) || !Array.isArray(laps) || !laps.every(isTime) || laps.length > 1000) return null;
  if (status === "running" ? !isTime(startedAt) : startedAt !== null) return null;
  return { status, startedAt: status === "running" ? (startedAt as number) : null, accumulatedMs, laps: laps as number[] };
}

export function parseCountdown(raw: unknown): CountdownState | null {
  if (!isRecord(raw)) return null;
  const { status, durationMs, remainingMs, endsAt } = raw;
  if (status !== "idle" && status !== "running" && status !== "paused" && status !== "finished") return null;
  if (!isTime(durationMs) || !isTime(remainingMs) || clampDuration(durationMs) !== durationMs || remainingMs > durationMs) return null;
  if (status === "running" ? !isTime(endsAt) : endsAt !== null) return null;
  return { status, durationMs, remainingMs, endsAt: status === "running" ? (endsAt as number) : null };
}
