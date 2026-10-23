import { describe, expect, it } from "vitest";
import type { Note } from "../../data/models";
import { createNote, displayTitle, excerpt, searchNotes, UNTITLED } from "./notes";

const n = (id: string, title: string, body: string, updatedAt: number): Note => ({ id, title, body, createdAt: 0, updatedAt });

describe("notes", () => {
  it("creates empty notes with unique ids", () => {
    const a = createNote(5);
    const b = createNote(5);
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ title: "", body: "", createdAt: 5, updatedAt: 5 });
  });

  it("derives a display title", () => {
    expect(displayTitle({ title: " ประชุม ", body: "" })).toBe("ประชุม");
    expect(displayTitle({ title: "", body: "\n\n  บรรทัดแรก\nสอง" })).toBe("บรรทัดแรก");
    expect(displayTitle({ title: "", body: "   " })).toBe(UNTITLED);
  });

  it("makes short excerpts", () => {
    expect(excerpt("a\n\nb")).toBe("a b");
    expect(excerpt("x".repeat(100), 10)).toBe(`${"x".repeat(10)}…`);
  });

  it("searches title and body, newest first", () => {
    const notes = [n("1", "ประชุมทีม", "วาระ", 1), n("2", "รายการซื้อ", "นม ไข่", 3), n("3", "", "ประชุมลูกค้า", 2)];
    expect(searchNotes(notes, "ประชุม").map((x) => x.id)).toEqual(["3", "1"]);
    expect(searchNotes(notes, "นม ไข่").map((x) => x.id)).toEqual(["2"]);
    expect(searchNotes(notes, "").map((x) => x.id)).toEqual(["2", "3", "1"]);
  });
});
