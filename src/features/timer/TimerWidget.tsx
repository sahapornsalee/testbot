import { useEffect, useId, useState } from "react";
import { Flag, Pause, Play, RotateCcw } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { usePersistentState } from "../../hooks/usePersistentState";
import { COUNTDOWN_KEY, parseCountdown, parseStopwatch, STOPWATCH_KEY } from "./persistence";
import {
  countdownRemaining,
  createCountdown,
  durationFromParts,
  formatCountdown,
  formatDuration,
  initialStopwatch,
  lapStopwatch,
  pauseCountdown,
  pauseStopwatch,
  resetCountdown,
  resetStopwatch,
  startCountdown,
  startStopwatch,
  stopwatchElapsed,
  tickCountdown,
} from "./timer";
import "./timer.css";

type Mode = "stopwatch" | "countdown";

export default function TimerWidget() {
  const [mode, setMode] = useState<Mode>("stopwatch");
  const tabsId = useId();

  return (
    <div className="timer">
      <div className="segmented" role="tablist" aria-label="โหมดจับเวลา">
        {(["stopwatch", "countdown"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${tabsId}-${m}-tab`}
            aria-selected={mode === m}
            aria-controls={`${tabsId}-${m}-panel`}
            tabIndex={mode === m ? 0 : -1}
            onClick={() => setMode(m)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                const next = mode === "stopwatch" ? "countdown" : "stopwatch";
                setMode(next);
                document.getElementById(`${tabsId}-${next}-tab`)?.focus();
              }
            }}
          >
            {m === "stopwatch" ? "จับเวลา" : "นับถอยหลัง"}
          </button>
        ))}
      </div>
      {/* Both panels stay mounted so switching tabs does not stop a running timer. */}
      <div role="tabpanel" id={`${tabsId}-stopwatch-panel`} aria-labelledby={`${tabsId}-stopwatch-tab`} hidden={mode !== "stopwatch"}>
        <Stopwatch />
      </div>
      <div role="tabpanel" id={`${tabsId}-countdown-panel`} aria-labelledby={`${tabsId}-countdown-tab`} hidden={mode !== "countdown"}>
        <Countdown />
      </div>
    </div>
  );
}

function Stopwatch() {
  const [state, setState] = usePersistentState(STOPWATCH_KEY, parseStopwatch, initialStopwatch);
  const running = state.status === "running";
  const now = useNow(50, running);
  const elapsed = stopwatchElapsed(state, now);

  return (
    <div className="timer-panel">
      <p className="timer-display" aria-live="off">
        {formatDuration(elapsed, true)}
      </p>
      <div className="timer-controls">
        {running ? (
          <button type="button" className="btn btn-primary" onClick={() => setState((s) => pauseStopwatch(s, Date.now()))}>
            <Pause aria-hidden="true" size={18} /> หยุด
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setState((s) => startStopwatch(s, Date.now()))}>
            <Play aria-hidden="true" size={18} /> {state.status === "paused" ? "ต่อ" : "เริ่ม"}
          </button>
        )}
        <button type="button" className="btn" disabled={!running} onClick={() => setState((s) => lapStopwatch(s, Date.now()))}>
          <Flag aria-hidden="true" size={18} /> รอบ
        </button>
        <button type="button" className="btn" disabled={state.status === "idle"} onClick={() => setState(resetStopwatch())}>
          <RotateCcw aria-hidden="true" size={18} /> รีเซ็ต
        </button>
      </div>
      {state.laps.length > 0 && (
        <ol className="timer-laps" aria-label="รอบที่บันทึก">
          {state.laps
            .map((total, index) => ({ total, split: total - (state.laps[index - 1] ?? 0), index }))
            .reverse()
            .map(({ total, split, index }) => (
              <li key={index}>
                <span>รอบ {index + 1}</span>
                <span>+{formatDuration(split, true)}</span>
                <strong>{formatDuration(total, true)}</strong>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => void ctx.close();
  } catch {
    // Sound is optional; the visual alert is always shown.
  }
}

function Countdown() {
  const [state, setState] = usePersistentState(COUNTDOWN_KEY, parseCountdown, () => createCountdown(5 * 60_000));
  const [parts, setParts] = useState(() => {
    const total = Math.round(state.durationMs / 1000);
    return {
      hours: String(Math.floor(total / 3600)),
      minutes: String(Math.floor((total % 3600) / 60)),
      seconds: String(total % 60),
    };
  });
  const now = useNow(200, state.status === "running");
  const formId = useId();

  // The effective state is derived from the wall clock, so a countdown that
  // ended while the tab was hidden (or the page was closed) shows as finished.
  const current = tickCountdown(state, now);
  const running = current.status === "running";
  const finished = current.status === "finished";

  // Beep only when the countdown ends while this page is open, not when
  // restoring an already finished countdown after a reload.
  const [wasRunning, setWasRunning] = useState(running);
  const [beeps, setBeeps] = useState(0);
  if (wasRunning !== running) {
    setWasRunning(running);
    if (wasRunning && finished) setBeeps((n) => n + 1);
  }
  useEffect(() => {
    if (beeps > 0) playBeep();
  }, [beeps]);

  // Clamp in case `now` is a few ms stale right after starting.
  const remaining = Math.min(countdownRemaining(current, now), current.durationMs);
  const editable = current.status === "idle" || finished;
  const requested = durationFromParts(Number(parts.hours), Number(parts.minutes), Number(parts.seconds));

  const start = () => {
    const base = editable ? createCountdown(requested) : current;
    setState(startCountdown(base, Date.now()));
  };

  const field = (key: keyof typeof parts, label: string, max: number) => (
    <label className="countdown-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={parts[key]}
        disabled={!editable}
        onChange={(event) => setParts((p) => ({ ...p, [key]: event.target.value }))}
      />
    </label>
  );

  return (
    <div className="timer-panel">
      <p className={`timer-display ${finished ? "is-finished" : ""}`}>{formatCountdown(remaining)}</p>
      <p className="timer-alert" role="alert">
        {finished ? "หมดเวลาแล้ว!" : ""}
      </p>
      <form
        id={formId}
        className="countdown-form"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        {field("hours", "ชั่วโมง", 99)}
        {field("minutes", "นาที", 59)}
        {field("seconds", "วินาที", 59)}
      </form>
      <div className="timer-controls">
        {running ? (
          <button type="button" className="btn btn-primary" onClick={() => setState(pauseCountdown(current, Date.now()))}>
            <Pause aria-hidden="true" size={18} /> หยุด
          </button>
        ) : (
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={editable && requested <= 0}
          >
            <Play aria-hidden="true" size={18} /> {current.status === "paused" ? "ต่อ" : "เริ่ม"}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={current.status === "idle"}
          onClick={() => setState(resetCountdown(current))}
        >
          <RotateCcw aria-hidden="true" size={18} /> รีเซ็ต
        </button>
      </div>
      {editable && requested <= 0 && <p className="timer-hint">กรุณากำหนดเวลามากกว่า 0 วินาที</p>}
    </div>
  );
}
