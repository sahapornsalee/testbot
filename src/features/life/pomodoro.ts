import { isRecord } from "../../lib/storage";

export const POMODORO_KEY = "productivity-hub:pomodoro";

export type Phase = "focus" | "short-break" | "long-break";

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Long break after this many focus sessions. */
  rounds: number;
}

export interface PomodoroState {
  version: 1;
  settings: PomodoroSettings;
  phase: Phase;
  /** Focus sessions completed in the current cycle. */
  completed: number;
  /** Total focus sessions completed today. */
  todayCount: number;
  todayDate: string;
  running: boolean;
  /** Wall-clock end while running; remaining ms while paused. */
  endsAt: number | null;
  remainingMs: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, rounds: 4 };

export function phaseMs(settings: PomodoroSettings, phase: Phase): number {
  const minutes = phase === "focus" ? settings.focusMinutes : phase === "short-break" ? settings.shortBreakMinutes : settings.longBreakMinutes;
  return minutes * 60_000;
}

export function createPomodoro(settings: PomodoroSettings = DEFAULT_SETTINGS, today = ""): PomodoroState {
  return { version: 1, settings, phase: "focus", completed: 0, todayCount: 0, todayDate: today, running: false, endsAt: null, remainingMs: phaseMs(settings, "focus") };
}

const validMinutes = (v: unknown, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max;

export function parsePomodoro(raw: unknown): PomodoroState | null {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.settings)) return null;
  const s = raw.settings;
  if (!validMinutes(s.focusMinutes, 180) || !validMinutes(s.shortBreakMinutes, 60) || !validMinutes(s.longBreakMinutes, 120) || !validMinutes(s.rounds, 12)) return null;
  const settings: PomodoroSettings = { focusMinutes: s.focusMinutes, shortBreakMinutes: s.shortBreakMinutes, longBreakMinutes: s.longBreakMinutes, rounds: s.rounds };
  if (raw.phase !== "focus" && raw.phase !== "short-break" && raw.phase !== "long-break") return null;
  if (typeof raw.running !== "boolean" || typeof raw.todayDate !== "string") return null;
  if (typeof raw.completed !== "number" || !Number.isInteger(raw.completed) || raw.completed < 0 || raw.completed > 12) return null;
  if (typeof raw.todayCount !== "number" || raw.todayCount < 0) return null;
  if (typeof raw.remainingMs !== "number" || raw.remainingMs < 0 || raw.remainingMs > phaseMs(settings, raw.phase)) return null;
  if (raw.running ? typeof raw.endsAt !== "number" : raw.endsAt !== null) return null;
  return {
    version: 1,
    settings,
    phase: raw.phase,
    completed: raw.completed,
    todayCount: Math.floor(raw.todayCount),
    todayDate: raw.todayDate,
    running: raw.running,
    endsAt: raw.running ? (raw.endsAt as number) : null,
    remainingMs: raw.remainingMs,
  };
}

export function remaining(state: PomodoroState, now: number): number {
  return state.running && state.endsAt !== null ? Math.max(0, state.endsAt - now) : state.remainingMs;
}

export function start(state: PomodoroState, now: number): PomodoroState {
  if (state.running) return state;
  return { ...state, running: true, endsAt: now + state.remainingMs };
}

export function pause(state: PomodoroState, now: number): PomodoroState {
  if (!state.running) return state;
  return { ...state, running: false, endsAt: null, remainingMs: remaining(state, now) };
}

/** Moves to the next phase (counting a finished focus session) and stops. */
export function advance(state: PomodoroState, today: string, countFocus = true): PomodoroState {
  let { completed, todayCount } = state;
  if (state.todayDate !== today) todayCount = 0;
  let phase: Phase;
  if (state.phase === "focus") {
    if (countFocus) {
      completed += 1;
      todayCount += 1;
    }
    phase = completed >= state.settings.rounds ? "long-break" : "short-break";
  } else {
    if (state.phase === "long-break") completed = 0;
    phase = "focus";
  }
  return { ...state, phase, completed, todayCount, todayDate: today, running: false, endsAt: null, remainingMs: phaseMs(state.settings, phase) };
}

/** Advances when the running phase has ended; otherwise returns the same state. */
export function tick(state: PomodoroState, now: number, today: string): PomodoroState {
  if (!state.running || remaining(state, now) > 0) return state;
  return advance(state, today);
}

export function reset(state: PomodoroState): PomodoroState {
  return { ...state, running: false, endsAt: null, remainingMs: phaseMs(state.settings, state.phase) };
}

export function updateSettings(state: PomodoroState, settings: PomodoroSettings): PomodoroState {
  return { ...state, settings, running: false, endsAt: null, remainingMs: phaseMs(settings, state.phase) };
}
