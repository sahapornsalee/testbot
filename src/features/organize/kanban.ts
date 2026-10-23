import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const KANBAN_KEY = "productivity-hub:kanban";
export const MAX_CARDS = 500;

export type Column = "todo" | "doing" | "done";
export const COLUMNS: { id: Column; title: string }[] = [
  { id: "todo", title: "ต้องทำ" },
  { id: "doing", title: "กำลังทำ" },
  { id: "done", title: "เสร็จแล้ว" },
];

export interface Card {
  id: string;
  title: string;
  note: string;
  column: Column;
  order: number;
  createdAt: number;
}

export interface KanbanData {
  version: 1;
  cards: Card[];
}

export const EMPTY_KANBAN: KanbanData = { version: 1, cards: [] };
const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";

export function parseKanban(raw: unknown): KanbanData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.cards)) return null;
  const cards: Card[] = [];
  for (const c of raw.cards.slice(0, MAX_CARDS)) {
    if (!isRecord(c) || typeof c.id !== "string" || typeof c.title !== "string" || !c.title.trim() || !isColumn(c.column)) continue;
    if (typeof c.order !== "number" || typeof c.createdAt !== "number") continue;
    cards.push({ id: c.id, title: c.title.slice(0, 300), note: typeof c.note === "string" ? c.note.slice(0, 5000) : "", column: c.column, order: c.order, createdAt: c.createdAt });
  }
  return { version: 1, cards };
}

export function cardsIn(data: KanbanData, column: Column): Card[] {
  return data.cards.filter((c) => c.column === column).sort((a, b) => a.order - b.order);
}

/** Renumbers a column 0..n-1 in the given order. */
function renumber(cards: Card[], column: Column, ordered: Card[]): Card[] {
  const orders = new Map(ordered.map((c, i) => [c.id, i]));
  return cards.map((c) => (c.column === column && orders.has(c.id) ? { ...c, order: orders.get(c.id) as number } : c));
}

export function addCard(data: KanbanData, title: string, column: Column, now: number): KanbanData {
  const clean = title.trim().slice(0, 300);
  if (!clean || data.cards.length >= MAX_CARDS) return data;
  const order = cardsIn(data, column).length;
  return { ...data, cards: [...data.cards, { id: createId(), title: clean, note: "", column, order, createdAt: now }] };
}

/** Moves a card to `column` at `index` (clamped), keeping both columns tidy. */
export function moveCard(data: KanbanData, id: string, column: Column, index: number): KanbanData {
  const card = data.cards.find((c) => c.id === id);
  if (!card) return data;
  const moved = { ...card, column };
  const target = cardsIn({ ...data, cards: data.cards.filter((c) => c.id !== id) }, column);
  target.splice(Math.max(0, Math.min(target.length, index)), 0, moved);
  let cards = data.cards.map((c) => (c.id === id ? moved : c));
  cards = renumber(cards, column, target);
  if (card.column !== column) cards = renumber(cards, card.column, cardsIn({ ...data, cards }, card.column));
  return { ...data, cards };
}

export function updateCard(data: KanbanData, id: string, patch: Partial<Pick<Card, "title" | "note">>): KanbanData {
  return {
    ...data,
    cards: data.cards.map((c) => (c.id === id ? { ...c, title: patch.title?.trim() ? patch.title.trim().slice(0, 300) : c.title, note: patch.note !== undefined ? patch.note.slice(0, 5000) : c.note } : c)),
  };
}

export function removeCard(data: KanbanData, id: string): KanbanData {
  return { ...data, cards: data.cards.filter((c) => c.id !== id) };
}
