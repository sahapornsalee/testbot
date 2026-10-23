/**
 * Stopwatch and countdown state machines.
 *
 * Elapsed time is derived from wall-clock timestamps rather than counted
 * ticks, so the displayed time stays correct when a background tab throttles
 * timers or the device sleeps.
 */

export interface StopwatchState {
  status: "idle" | "running" | "paused";
  /** Timestamp of the most recent start/resume while running. */
  startedAt: number | null;
  /** Time accumulated before the current run segment. */
  accumulatedMs: number;
  /** Elapsed total at each lap, oldest first. */
  laps: number[];
}

export const initialStopwatch: StopwatchState = {
  status: "idle",
  startedAt: null,
  accumulatedMs: 0,
  laps: [],
};

export function stopwatchElapsed(state: StopwatchState, now: number): number {
  if (state.status !== "running" || state.startedAt === null) return state.accumulatedMs;
  return state.accumulatedMs + Math.max(0, now - state.startedAt);
}

export function startStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status === "running") return state;
  return { ...state, status: "running", startedAt: now };
}

export function pauseStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== "running") return state;
  return { ...state, status: "paused", startedAt: null, accumulatedMs: stopwatchElapsed(state, now) };
}

export function lapStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== "running") return state;
  return { ...state, laps: [...state.laps, stopwatchElapsed(state, now)] };
}

export function resetStopwatch(): StopwatchState {
  return initialStopwatch;
}

export const MAX_COUNTDOWN_MS = 99 * 3600_000 + 59 * 60_000 + 59_000;

export interface CountdownState {
  status: "idle" | "running" | "paused" | "finished";
  durationMs: number;
  /** Remaining time when not running. */
  remainingMs: number;
  /** Target timestamp while running. */
  endsAt: number | null;
}

export function createCountdown(durationMs: number): CountdownState {
  const clamped = clampDuration(durationMs);
  return { status: "idle", durationMs: clamped, remainingMs: clamped, endsAt: null };
}

export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(Math.round(ms), MAX_COUNTDOWN_MS);
}

export function countdownRemaining(state: CountdownState, now: number): number {
  if (state.status !== "running" || state.endsAt === null) return state.remainingMs;
  return Math.max(0, state.endsAt - now);
}

export function startCountdown(state: CountdownState, now: number): CountdownState {
  if (state.status === "running" || state.remainingMs <= 0) return state;
  return { ...state, status: "running", endsAt: now + state.remainingMs };
}

export function pauseCountdown(state: CountdownState, now: number): CountdownState {
  if (state.status !== "running") return state;
  return { ...state, status: "paused", remainingMs: countdownRemaining(state, now), endsAt: null };
}

/** Moves a running countdown to "finished" once its end time has passed. */
export function tickCountdown(state: CountdownState, now: number): CountdownState {
  if (state.status !== "running" || countdownRemaining(state, now) > 0) return state;
  return { ...state, status: "finished", remainingMs: 0, endsAt: null };
}

export function resetCountdown(state: CountdownState): CountdownState {
  return createCountdown(state.durationMs);
}

export function durationFromParts(hours: number, minutes: number, seconds: number): number {
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return clampDuration(safe(hours) * 3600_000 + safe(minutes) * 60_000 + safe(seconds) * 1000);
}

/** Formats milliseconds as H:MM:SS or MM:SS, optionally with hundredths. */
export function formatDuration(ms: number, withHundredths = false): string {
  const total = Math.max(0, Math.floor(ms));
  const hours = Math.floor(total / 3600_000);
  const minutes = Math.floor((total % 3600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  let text = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  if (withHundredths) text += `.${pad(Math.floor((total % 1000) / 10))}`;
  return text;
}

/** Countdown display rounds up so "00:01" shows until the final second ends. */
export function formatCountdown(ms: number): string {
  return formatDuration(Math.ceil(ms / 1000) * 1000);
}
