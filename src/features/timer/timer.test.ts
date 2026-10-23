import { describe, expect, it } from "vitest";
import {
  countdownRemaining,
  createCountdown,
  durationFromParts,
  formatCountdown,
  formatDuration,
  initialStopwatch,
  lapStopwatch,
  MAX_COUNTDOWN_MS,
  pauseCountdown,
  pauseStopwatch,
  resetCountdown,
  resetStopwatch,
  startCountdown,
  startStopwatch,
  stopwatchElapsed,
  tickCountdown,
} from "./timer";

describe("stopwatch", () => {
  it("measures elapsed time from timestamps", () => {
    const running = startStopwatch(initialStopwatch, 1_000);
    expect(stopwatchElapsed(running, 3_500)).toBe(2_500);
  });

  it("pauses and resumes without losing time", () => {
    let state = startStopwatch(initialStopwatch, 0);
    state = pauseStopwatch(state, 4_000);
    expect(stopwatchElapsed(state, 60_000)).toBe(4_000);
    state = startStopwatch(state, 10_000);
    expect(stopwatchElapsed(state, 11_000)).toBe(5_000);
  });

  it("stays accurate after a long time in a background tab", () => {
    const state = startStopwatch(initialStopwatch, 0);
    // No ticks happened for two hours; elapsed is still exact.
    expect(stopwatchElapsed(state, 7_200_000)).toBe(7_200_000);
  });

  it("records laps only while running", () => {
    let state = startStopwatch(initialStopwatch, 0);
    state = lapStopwatch(state, 1_000);
    state = lapStopwatch(state, 2_500);
    expect(state.laps).toEqual([1_000, 2_500]);
    state = pauseStopwatch(state, 3_000);
    expect(lapStopwatch(state, 4_000).laps).toHaveLength(2);
  });

  it("ignores duplicate start and pause", () => {
    const running = startStopwatch(initialStopwatch, 0);
    expect(startStopwatch(running, 5_000)).toBe(running);
    expect(pauseStopwatch(initialStopwatch, 5_000)).toBe(initialStopwatch);
  });

  it("resets to zero", () => {
    expect(stopwatchElapsed(resetStopwatch(), 99)).toBe(0);
  });

  it("never reports negative time if the clock moves backwards", () => {
    const running = startStopwatch(initialStopwatch, 5_000);
    expect(stopwatchElapsed(running, 1_000)).toBe(0);
  });
});

describe("countdown", () => {
  it("counts down and finishes", () => {
    let state = startCountdown(createCountdown(10_000), 0);
    expect(countdownRemaining(state, 4_000)).toBe(6_000);
    expect(tickCountdown(state, 9_999).status).toBe("running");
    state = tickCountdown(state, 10_000);
    expect(state.status).toBe("finished");
    expect(countdownRemaining(state, 20_000)).toBe(0);
  });

  it("finishes correctly when the tab was in the background past the end", () => {
    const state = tickCountdown(startCountdown(createCountdown(5_000), 0), 3_600_000);
    expect(state.status).toBe("finished");
    expect(state.remainingMs).toBe(0);
  });

  it("pauses and resumes", () => {
    let state = startCountdown(createCountdown(10_000), 0);
    state = pauseCountdown(state, 3_000);
    expect(countdownRemaining(state, 50_000)).toBe(7_000);
    state = startCountdown(state, 50_000);
    expect(countdownRemaining(state, 52_000)).toBe(5_000);
  });

  it("does not start with zero duration", () => {
    const state = createCountdown(0);
    expect(startCountdown(state, 0)).toBe(state);
  });

  it("resets to the original duration", () => {
    const finished = tickCountdown(startCountdown(createCountdown(1_000), 0), 2_000);
    const reset = resetCountdown(finished);
    expect(reset.status).toBe("idle");
    expect(reset.remainingMs).toBe(1_000);
  });

  it("clamps invalid durations", () => {
    expect(createCountdown(-5).durationMs).toBe(0);
    expect(createCountdown(Number.NaN).durationMs).toBe(0);
    expect(createCountdown(Number.POSITIVE_INFINITY).durationMs).toBe(0);
    expect(createCountdown(1e12).durationMs).toBe(MAX_COUNTDOWN_MS);
  });

  it("builds durations from parts and ignores invalid parts", () => {
    expect(durationFromParts(1, 2, 3)).toBe(3_723_000);
    expect(durationFromParts(-1, Number.NaN, 30)).toBe(30_000);
  });
});

describe("duration formatting", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatDuration(1_234, true)).toBe("00:01.23");
  });

  it("rounds countdown display up", () => {
    expect(formatCountdown(500)).toBe("00:01");
    expect(formatCountdown(1_000)).toBe("00:01");
    expect(formatCountdown(1_001)).toBe("00:02");
    expect(formatCountdown(0)).toBe("00:00");
  });
});
