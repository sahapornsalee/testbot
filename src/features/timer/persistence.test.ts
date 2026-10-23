import { describe, expect, it } from "vitest";
import { parseCountdown, parseStopwatch } from "./persistence";

describe("timer persistence", () => {
  it("restores a running stopwatch", () => {
    const state = { status: "running", startedAt: 1000, accumulatedMs: 500, laps: [100] };
    expect(parseStopwatch(state)).toEqual(state);
  });

  it("rejects inconsistent stopwatch data", () => {
    expect(parseStopwatch({ status: "running", startedAt: null, accumulatedMs: 0, laps: [] })).toBeNull();
    expect(parseStopwatch({ status: "paused", startedAt: 5, accumulatedMs: 0, laps: [] })).toBeNull();
    expect(parseStopwatch({ status: "idle", startedAt: null, accumulatedMs: -1, laps: [] })).toBeNull();
    expect(parseStopwatch({ status: "weird" })).toBeNull();
  });

  it("restores countdowns and rejects invalid ones", () => {
    const running = { status: "running", durationMs: 60_000, remainingMs: 60_000, endsAt: 99 };
    expect(parseCountdown(running)).toEqual(running);
    expect(parseCountdown({ ...running, remainingMs: 70_000 })).toBeNull();
    expect(parseCountdown({ ...running, endsAt: null })).toBeNull();
    expect(parseCountdown({ ...running, durationMs: 1e15, remainingMs: 0 })).toBeNull();
  });
});
