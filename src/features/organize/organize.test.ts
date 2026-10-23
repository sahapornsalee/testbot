import { describe, expect, it } from "vitest";
import { zonedTimeToInstant } from "../../lib/datetime";
import { addCard, cardsIn, EMPTY_KANBAN, moveCard, parseKanban, removeCard, updateCard } from "./kanban";
import { createReminder, dueReminders, EMPTY_REMINDERS, markNotified, parseReminders, setDone, snooze, sortReminders } from "./reminders";
import { decryptEntries, encryptEntries, parseVault, passwordProblem, WrongPasswordError } from "./vault";

describe("vault", () => {
  const entries = [{ id: "a", title: "Wi-Fi บ้าน", body: "รหัส: secret123" }];

  it("encrypts so the text is unreadable, and decrypts with the right password", async () => {
    const vault = await encryptEntries(entries, "correct horse", 100_000);
    expect(JSON.stringify(vault)).not.toContain("secret123");
    expect(await decryptEntries(vault, "correct horse")).toEqual(entries);
  });

  it("rejects a wrong password and tampered data", async () => {
    const vault = await encryptEntries(entries, "correct horse", 100_000);
    await expect(decryptEntries(vault, "wrong")).rejects.toBeInstanceOf(WrongPasswordError);
    const tampered = { ...vault, data: btoa(String.fromCharCode(...Uint8Array.from(atob(vault.data), (c, i) => (i === 0 ? c.charCodeAt(0) ^ 1 : c.charCodeAt(0))))) };
    await expect(decryptEntries(tampered, "correct horse")).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("uses a fresh salt and IV each time", async () => {
    const a = await encryptEntries(entries, "pw123456", 100_000);
    const b = await encryptEntries(entries, "pw123456", 100_000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it("validates stored data and passwords", () => {
    expect(parseVault({ version: 1, iterations: 10, salt: "", iv: "", data: "" })).toBeNull();
    expect(parseVault({ version: 1, iterations: 310_000, salt: "a", iv: "b", data: "c" })).not.toBeNull();
    expect(passwordProblem("short", "short")).toContain("8");
    expect(passwordProblem("longenough", "different")).toContain("ไม่ตรง");
    expect(passwordProblem("longenough", "longenough")).toBeNull();
  });
});

describe("kanban", () => {
  it("adds, moves within and across columns, and renumbers", () => {
    let d = addCard(EMPTY_KANBAN, "A", "todo", 1);
    d = addCard(d, "B", "todo", 2);
    d = addCard(d, "C", "todo", 3);
    const [a, b, c] = cardsIn(d, "todo");
    d = moveCard(d, c!.id, "todo", 0);
    expect(cardsIn(d, "todo").map((x) => x.title)).toEqual(["C", "A", "B"]);
    d = moveCard(d, a!.id, "doing", 5);
    expect(cardsIn(d, "todo").map((x) => [x.title, x.order])).toEqual([["C", 0], ["B", 1]]);
    expect(cardsIn(d, "doing").map((x) => [x.title, x.order])).toEqual([["A", 0]]);
    d = updateCard(d, b!.id, { title: "  B2 ", note: "รายละเอียด" });
    expect(d.cards.find((x) => x.id === b!.id)).toMatchObject({ title: "B2", note: "รายละเอียด" });
    expect(updateCard(d, b!.id, { title: " " }).cards.find((x) => x.id === b!.id)?.title).toBe("B2");
    expect(removeCard(d, a!.id).cards).toHaveLength(2);
    expect(addCard(d, "  ", "todo", 1)).toBe(d);
  });

  it("validates stored boards", () => {
    expect(parseKanban({ version: 1, cards: [{ id: "a", title: "x", column: "later", order: 0, createdAt: 1 }, { id: "b", title: "y", column: "done", order: 0, createdAt: 1 }] })?.cards.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("reminders", () => {
  it("fires once when due, snoozes and completes", () => {
    const r = createReminder(" ประชุม ", 1_000)!;
    let d = { ...EMPTY_REMINDERS, reminders: [r] };
    expect(dueReminders(d, 999)).toEqual([]);
    expect(dueReminders(d, 1_000).map((x) => x.title)).toEqual(["ประชุม"]);
    d = markNotified(d, [r.id]);
    expect(dueReminders(d, 5_000)).toEqual([]);
    d = snooze(d, r.id, 5_000, 10);
    expect(d.reminders[0]).toMatchObject({ at: 605_000, notified: false });
    d = setDone(d, r.id, true);
    expect(dueReminders(d, 10_000_000)).toEqual([]);
    expect(createReminder(" ", 1)).toBeNull();
  });

  it("sorts open reminders first and validates storage", () => {
    const list = [
      { id: "1", title: "a", at: 3, done: true, notified: true },
      { id: "2", title: "b", at: 5, done: false, notified: false },
      { id: "3", title: "c", at: 1, done: false, notified: false },
    ];
    expect(sortReminders(list).map((r) => r.id)).toEqual(["3", "2", "1"]);
    expect(parseReminders({ version: 1, reminders: [...list, { id: "x", title: "", at: 1 }] })?.reminders).toHaveLength(3);
  });

  it("converts a wall-clock time in a zone to an instant", () => {
    expect(new Date(zonedTimeToInstant({ year: 2026, month: 10, day: 24 }, 9, 0, "Asia/Bangkok")).toISOString()).toBe("2026-10-24T02:00:00.000Z");
    expect(new Date(zonedTimeToInstant({ year: 2026, month: 7, day: 1 }, 9, 0, "Europe/London")).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(new Date(zonedTimeToInstant({ year: 2026, month: 1, day: 1 }, 9, 0, "Europe/London")).toISOString()).toBe("2026-01-01T09:00:00.000Z");
  });
});
