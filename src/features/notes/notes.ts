import { createId } from "../../data/db";
import type { Note } from "../../data/models";

export const UNTITLED = "บันทึกไม่มีชื่อ";

export function createNote(now: number): Note {
  return { id: createId(), title: "", body: "", createdAt: now, updatedAt: now };
}

/** Display title: the title, else the first non-empty line of the body. */
export function displayTitle(note: Pick<Note, "title" | "body">): string {
  const title = note.title.trim();
  if (title) return title;
  const firstLine = note.body.split("\n").find((line) => line.trim() !== "");
  return firstLine ? firstLine.trim().slice(0, 80) : UNTITLED;
}

export function excerpt(body: string, length = 90): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function searchNotes(notes: readonly Note[], query: string): Note[] {
  const terms = query.toLocaleLowerCase("th-TH").split(/\s+/).filter(Boolean);
  return [...notes]
    .filter((note) => {
      const text = `${note.title}\n${note.body}`.toLocaleLowerCase("th-TH");
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatUpdated(timestamp: number): string {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}
