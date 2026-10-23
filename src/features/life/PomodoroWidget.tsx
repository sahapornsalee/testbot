import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { usePersistentState } from "../../hooks/usePersistentState";
import { playBeep } from "../../lib/sound";
import { toIsoDate } from "../calendar/dates";
import { useDateTime } from "../settings/SettingsContext";
import { formatCountdown } from "../timer/timer";
import { advance, createPomodoro, parsePomodoro, pause, POMODORO_KEY, remaining, reset, start, tick, updateSettings, type Phase, type PomodoroSettings } from "./pomodoro";
import "./life.css";

/** Wall-clock time for event handlers (kept out of render). */
function currentTime(): number {
  return Date.now();
}

const PHASE_LABEL: Record<Phase, string> = { focus: "🍅 โฟกัส", "short-break": "☕ พักสั้น", "long-break": "🌿 พักยาว" };

export default function PomodoroWidget() {
  const { today } = useDateTime();
  const todayIso = toIsoDate(today());
  const [stored, setStored] = usePersistentState(POMODORO_KEY, parsePomodoro, () => createPomodoro(undefined, todayIso));
  const now = useNow(250, stored.running);
  // Derived from the wall clock, so a phase that ended while hidden shows as done.
  const state = tick(stored, now, todayIso);
  const [lastPhase, setLastPhase] = useState(state.phase);
  const [beeps, setBeeps] = useState(0);
  if (lastPhase !== state.phase) {
    setLastPhase(state.phase);
    if (stored.running) setBeeps((n) => n + 1);
  }
  useEffect(() => {
    if (beeps > 0) playBeep(1.2, 660);
  }, [beeps]);

  const left = remaining(state, now);
  const setSetting = (key: keyof PomodoroSettings, value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > (key === "rounds" ? 12 : 180)) return;
    setStored(updateSettings(state, { ...state.settings, [key]: n }));
  };
  const todayCount = state.todayDate === todayIso ? state.todayCount : 0;
  const onPause = () => setStored(pause(state, currentTime()));
  const onStart = () => setStored(start(state, currentTime()));

  return (
    <div className="stack">
      <p className={`pomodoro-phase ${state.phase !== "focus" ? "is-break" : ""}`} role="status">
        {PHASE_LABEL[state.phase]} · รอบที่ {Math.min(state.completed + (state.phase === "focus" ? 1 : 0), state.settings.rounds)}/{state.settings.rounds}
      </p>
      <p className="big-number timer-display">{formatCountdown(left)}</p>
      <div className="timer-controls">
        {state.running ? (
          <button type="button" className="btn btn-primary" onClick={onPause}>
            <Pause aria-hidden="true" size={18} /> หยุด
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            <Play aria-hidden="true" size={18} /> เริ่ม
          </button>
        )}
        <button type="button" className="btn" onClick={() => setStored(advance(state, todayIso, false))}>
          <SkipForward aria-hidden="true" size={18} /> ข้าม
        </button>
        <button type="button" className="btn" onClick={() => setStored(reset(state))}>
          <RotateCcw aria-hidden="true" size={18} /> เริ่มใหม่
        </button>
      </div>
      <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
        วันนี้โฟกัสไปแล้ว {todayCount} รอบ ({todayCount * state.settings.focusMinutes} นาที)
      </p>
      <details>
        <summary>ตั้งค่าเวลา</summary>
        <div className="field-row" style={{ marginTop: "var(--space-3)" }}>
          {(
            [
              ["focusMinutes", "โฟกัส (นาที)"],
              ["shortBreakMinutes", "พักสั้น (นาที)"],
              ["longBreakMinutes", "พักยาว (นาที)"],
              ["rounds", "พักยาวทุกกี่รอบ"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="field">
              {label}
              <input className="input" type="number" min={1} defaultValue={state.settings[key]} onBlur={(e) => setSetting(key, e.target.value)} />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
