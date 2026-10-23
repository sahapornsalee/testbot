import { useEffect, useId, useState } from "react";
import { Flag, Pause, Play, RotateCcw } from "lucide-react";
import { useNow } from "../../hooks/useNow";
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
  const [state, setState] = useState(initialStopwatch);
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
  const [state, setState] = useState(() => createCountdown(5 * 60_000));
  const [parts, setParts] = useState({ hours: "0", minutes: "5", seconds: "0" });
  const running = state.status === "running";
  const now = useNow(200, running);
  const formId = useId();

  // Derive "finished" from the wall clock (correct even after a background tab).
  const ticked = tickCountdown(state, now);
  if (ticked !== state) setState(ticked);

  const finished = state.status === "finished";
  useEffect(() => {
    if (finished) playBeep();
  }, [finished]);

  // Clamp in case `now` is a few ms stale right after starting.
  const remaining = Math.min(countdownRemaining(state, now), state.durationMs);
  const editable = state.status === "idle" || state.status === "finished";
  const requested = durationFromParts(Number(parts.hours), Number(parts.minutes), Number(parts.seconds));

  const start = () => {
    setState((s) => {
      const base = s.status === "idle" || s.status === "finished" ? createCountdown(requested) : s;
      return startCountdown(base, Date.now());
    });
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
          <button type="button" className="btn btn-primary" onClick={() => setState((s) => pauseCountdown(s, Date.now()))}>
            <Pause aria-hidden="true" size={18} /> หยุด
          </button>
        ) : (
          <button
            type="submit"
            form={formId}
            className="btn btn-primary"
            disabled={editable && requested <= 0}
          >
            <Play aria-hidden="true" size={18} /> {state.status === "paused" ? "ต่อ" : "เริ่ม"}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={state.status === "idle"}
          onClick={() => setState((s) => resetCountdown(s))}
        >
          <RotateCcw aria-hidden="true" size={18} /> รีเซ็ต
        </button>
      </div>
      {editable && requested <= 0 && <p className="timer-hint">กรุณากำหนดเวลามากกว่า 0 วินาที</p>}
    </div>
  );
}
