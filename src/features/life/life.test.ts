import { describe, expect, it } from "vitest";
import { randomBetween, randomInt, shuffle } from "../../lib/random";
import { age, zodiacAnimal } from "./age";
import { addCounter, changeCounter, DEFAULT_COUNTERS, parseCounters, removeCounter, resetCounter } from "./counters";
import { createEvent, daysUntil, nextOccurrence, parseEvents, sortEvents } from "./events";
import { addHabit, currentStreak, lastDays, longestStreak, parseHabits, toggleDay, EMPTY_HABITS } from "./habits";
import { bmi, energy, waterLiters } from "./health";
import { advance, createPomodoro, parsePomodoro, pause, remaining, start, tick, updateSettings } from "./pomodoro";
import { describeDifference, isValidZone, parseWorldClock, zoneOffsetMinutes } from "./worldClock";

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("health", () => {
  it("computes BMI with Asian cut-offs", () => {
    const r = bmi(70, 175);
    expect(r.ok && r.value).toEqual({ bmi: 22.9, category: "ปกติ (สุขภาพดี)", healthyMin: 56.7, healthyMax: 70.1 });
    expect(bmi(80, 170).ok && (bmi(80, 170) as { value: { category: string } }).value.category).toBe("อ้วนระดับ 1");
    expect(bmi(45, 170).ok && (bmi(45, 170) as { value: { category: string } }).value.category).toBe("น้ำหนักน้อย");
    expect(bmi(70, 10).ok).toBe(false);
    expect(bmi(Number.NaN, 170).ok).toBe(false);
  });

  it("computes BMR and TDEE", () => {
    expect(energy("male", 70, 175, 30, 1.2)).toEqual({ ok: true, value: { bmr: 1649, tdee: 1979 } });
    expect(energy("female", 55, 160, 25, 1.55)).toEqual({ ok: true, value: { bmr: 1264, tdee: 1959 } });
    expect(energy("male", 70, 175, 5, 1.2).ok).toBe(false);
    expect(waterLiters(70)).toBe(2.1);
  });
});

describe("age", () => {
  it("computes age, next birthday and zodiac", () => {
    const r = age(d(1990, 5, 15), d(2026, 10, 23));
    expect(r.ok && r.value).toMatchObject({ years: 36, months: 5, days: 8, daysToBirthday: 204, nextBirthdayAge: 37, animal: "มะเมีย (ม้า)" });
  });

  it("handles birthdays today and leap-day birthdays", () => {
    expect(age(d(2000, 10, 23), d(2026, 10, 23)).ok && (age(d(2000, 10, 23), d(2026, 10, 23)) as { value: { daysToBirthday: number } }).value.daysToBirthday).toBe(0);
    const leap = age(d(2000, 2, 29), d(2026, 3, 1));
    expect(leap.ok && leap.value.daysToBirthday).toBe(364); // next is 28 Feb 2027
    expect(age(d(2030, 1, 1), d(2026, 1, 1)).ok).toBe(false);
  });

  it("maps years to animals", () => {
    expect(zodiacAnimal(2024)).toBe("มะโรง (งูใหญ่)");
    expect(zodiacAnimal(2026)).toBe("มะเมีย (ม้า)");
    expect(zodiacAnimal(1900)).toBe("ชวด (หนู)");
  });
});

describe("habits", () => {
  const today = d(2026, 10, 23);
  it("tracks streaks", () => {
    let data = addHabit(EMPTY_HABITS, " ดื่มน้ำ ", 1);
    const id = data.habits[0]!.id;
    for (const day of [d(2026, 10, 20), d(2026, 10, 21), d(2026, 10, 22)]) data = toggleDay(data, id, day);
    const habit = data.habits[0]!;
    expect(habit.name).toBe("ดื่มน้ำ");
    expect(currentStreak(habit, today)).toBe(3); // today not yet done keeps streak
    expect(currentStreak(toggleDay(data, id, today).habits[0]!, today)).toBe(4);
    expect(currentStreak(habit, d(2026, 10, 25))).toBe(0);
    expect(longestStreak({ ...habit, done: ["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"] })).toBe(3);
    expect(toggleDay(data, id, d(2026, 10, 21)).habits[0]!.done).toEqual(["2026-10-20", "2026-10-22"]);
  });

  it("validates stored data and ignores blank names", () => {
    expect(addHabit(EMPTY_HABITS, "  ", 1)).toBe(EMPTY_HABITS);
    expect(parseHabits({ version: 1, habits: [{ id: "a", name: "x", createdAt: 1, done: ["2026-02-30", "2026-01-02", "2026-01-01", "2026-01-01"] }, { id: 1 }] })).toEqual({
      version: 1,
      habits: [{ id: "a", name: "x", createdAt: 1, done: ["2026-01-01", "2026-01-02"] }],
    });
    expect(parseHabits({ version: 2 })).toBeNull();
    expect(lastDays(today, 3)).toEqual([d(2026, 10, 21), d(2026, 10, 22), today]);
  });
});

describe("events", () => {
  const today = d(2026, 10, 23);
  it("counts days and rolls yearly events over", () => {
    const newYear = createEvent("ปีใหม่", "2027-01-01", false)!;
    const birthday = createEvent("วันเกิด", "1990-05-15", true)!;
    const past = createEvent("สอบ", "2026-10-01", false)!;
    expect(daysUntil(newYear, today)).toBe(70);
    expect(nextOccurrence(birthday, today)).toEqual(d(2027, 5, 15));
    expect(daysUntil(past, today)).toBe(-22);
    expect(sortEvents([past, birthday, newYear], today).map((e) => e.title)).toEqual(["ปีใหม่", "วันเกิด", "สอบ"]);
    expect(createEvent("  ", "2026-01-01", false)).toBeNull();
    expect(createEvent("x", "2026-02-30", false)).toBeNull();
  });

  it("validates stored events", () => {
    expect(parseEvents({ version: 1, events: [{ id: "a", title: "x", date: "bad" }, { id: "b", title: "y", date: "2026-01-01", yearly: true }] })?.events).toEqual([
      { id: "b", title: "y", date: "2026-01-01", yearly: true },
    ]);
  });
});

describe("counters", () => {
  it("counts by step, resets and removes", () => {
    let data = addCounter(DEFAULT_COUNTERS, "คนเข้างาน", 5);
    const id = data.counters[1]!.id;
    data = changeCounter(changeCounter(data, id, 1), id, 1);
    expect(data.counters[1]!.value).toBe(10);
    data = changeCounter(data, id, -1);
    expect(data.counters[1]!.value).toBe(5);
    expect(resetCounter(data, id).counters[1]!.value).toBe(0);
    expect(removeCounter(data, id).counters).toHaveLength(1);
    expect(addCounter(DEFAULT_COUNTERS, "", 0).counters[1]).toMatchObject({ name: "ตัวนับ", step: 1 });
  });

  it("validates stored counters", () => {
    expect(parseCounters({ version: 1, counters: [{ id: "a", name: "x", value: 1.5, step: 1 }, { id: "b", name: "y", value: 3, step: 2 }] })?.counters).toEqual([
      { id: "b", name: "y", value: 3, step: 2 },
    ]);
  });
});

describe("pomodoro", () => {
  it("runs focus then breaks and a long break after the set rounds", () => {
    let s = createPomodoro({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, rounds: 2 }, "2026-10-23");
    s = start(s, 0);
    expect(remaining(s, 60_000)).toBe(24 * 60_000);
    s = tick(s, 25 * 60_000, "2026-10-23");
    expect(s).toMatchObject({ phase: "short-break", completed: 1, todayCount: 1, running: false });
    s = advance(s, "2026-10-23");
    expect(s.phase).toBe("focus");
    s = advance(s, "2026-10-23");
    expect(s).toMatchObject({ phase: "long-break", completed: 2, todayCount: 2 });
    s = advance(s, "2026-10-23");
    expect(s).toMatchObject({ phase: "focus", completed: 0 });
  });

  it("pauses, resets the daily count on a new day and validates storage", () => {
    let s = start(createPomodoro(undefined, "2026-10-22"), 0);
    s = pause(s, 10 * 60_000);
    expect(s.remainingMs).toBe(15 * 60_000);
    expect(advance({ ...s, todayCount: 7 }, "2026-10-23").todayCount).toBe(1);
    expect(parsePomodoro(s)).toEqual(s);
    expect(parsePomodoro({ ...s, remainingMs: 999 * 60_000 })).toBeNull();
    expect(parsePomodoro({ ...s, running: true, endsAt: null })).toBeNull();
    expect(updateSettings(s, { ...s.settings, focusMinutes: 50 }).remainingMs).toBe(50 * 60_000);
  });
});

describe("world clock", () => {
  it("computes zone offsets and describes differences", () => {
    const date = new Date(Date.UTC(2026, 0, 15, 12));
    expect(zoneOffsetMinutes("Asia/Bangkok", date)).toBe(420);
    expect(zoneOffsetMinutes("America/New_York", date)).toBe(-300);
    expect(zoneOffsetMinutes("Asia/Kolkata", date)).toBe(330);
    expect(zoneOffsetMinutes("America/New_York", new Date(Date.UTC(2026, 6, 15, 12)))).toBe(-240);
    expect(describeDifference(0)).toBe("เวลาเดียวกับเครื่องนี้");
    expect(describeDifference(120)).toBe("เร็วกว่า 2 ชม.");
    expect(describeDifference(-690)).toBe("ช้ากว่า 11 ชม. 30 นาที");
  });

  it("validates zones", () => {
    expect(isValidZone("Asia/Bangkok")).toBe(true);
    expect(isValidZone("Mars/Base")).toBe(false);
    expect(parseWorldClock({ version: 1, zones: ["UTC", "Mars/Base", "UTC"] })).toEqual({ version: 1, zones: ["UTC"] });
  });
});

describe("random", () => {
  it("stays within bounds and covers all values", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const v = randomBetween(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(() => randomInt(0)).toThrow();
  });

  it("shuffles without losing items", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(items).sort((a, b) => a - b)).toEqual(items);
  });
});

describe("emergency", async () => {
  const { parseMedical, telHref, EMERGENCY_NUMBERS } = await import("./emergency");
  it("validates medical info and phone links", () => {
    expect(parseMedical({ version: 1, name: "สมชาย", bloodType: 5, extra: "x" })).toMatchObject({ name: "สมชาย", bloodType: "" });
    expect(parseMedical({ version: 2 })).toBeNull();
    expect(telHref("081-234-5678")).toBe("tel:0812345678");
    expect(telHref("+66 81 234 5678")).toBe("tel:+66812345678");
    expect(telHref("abc")).toBeNull();
    expect(new Set(EMERGENCY_NUMBERS.map((e) => e.number)).size).toBe(EMERGENCY_NUMBERS.length);
  });
});
