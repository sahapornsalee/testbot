import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { addCard, cardsIn, COLUMNS, EMPTY_KANBAN, KANBAN_KEY, moveCard, parseKanban, removeCard, updateCard, type Card, type Column } from "./kanban";
import "./organize.css";

export default function KanbanWidget() {
  const [data, setData] = usePersistentState(KANBAN_KEY, parseKanban, EMPTY_KANBAN);
  const [title, setTitle] = useState("");
  const [over, setOver] = useState<Column | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; note: string } | null>(null);

  const onDrop = (event: DragEvent, column: Column) => {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData("text/plain");
    if (id) setData((d) => moveCard(d, id, column, cardsIn(d, column).length));
  };

  const columnIndex = (c: Column) => COLUMNS.findIndex((x) => x.id === c);

  const renderCard = (card: Card, index: number, list: Card[]) =>
    editing?.id === card.id ? (
      <form
        key={card.id}
        className="kanban-card stack"
        onSubmit={(e) => {
          e.preventDefault();
          setData((d) => updateCard(d, card.id, { title: editing.title, note: editing.note }));
          setEditing(null);
        }}
      >
        <input className="input" aria-label="ชื่องาน" value={editing.title} autoFocus onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
        <textarea className="input" aria-label="รายละเอียด" rows={3} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
        <div className="button-row">
          <button type="submit" className="btn small btn-primary">
            บันทึก
          </button>
          <button type="button" className="btn small" onClick={() => setEditing(null)}>
            ยกเลิก
          </button>
        </div>
      </form>
    ) : (
      <li key={card.id} className="kanban-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}>
        <strong>{card.title}</strong>
        {card.note && <p>{card.note}</p>}
        <div className="task-actions">
          <button type="button" className="icon-btn small-btn" aria-label={`ย้าย “${card.title}” ไปช่องซ้าย`} disabled={columnIndex(card.column) === 0} onClick={() => setData((d) => moveCard(d, card.id, COLUMNS[columnIndex(card.column) - 1]!.id, Infinity))}>
            <ArrowLeft aria-hidden="true" size={14} />
          </button>
          <button type="button" className="icon-btn small-btn" aria-label={`ย้าย “${card.title}” ไปช่องขวา`} disabled={columnIndex(card.column) === COLUMNS.length - 1} onClick={() => setData((d) => moveCard(d, card.id, COLUMNS[columnIndex(card.column) + 1]!.id, Infinity))}>
            <ArrowRight aria-hidden="true" size={14} />
          </button>
          <button type="button" className="icon-btn small-btn" aria-label={`เลื่อน “${card.title}” ขึ้น`} disabled={index === 0} onClick={() => setData((d) => moveCard(d, card.id, card.column, index - 1))}>
            <ArrowUp aria-hidden="true" size={14} />
          </button>
          <button type="button" className="icon-btn small-btn" aria-label={`เลื่อน “${card.title}” ลง`} disabled={index === list.length - 1} onClick={() => setData((d) => moveCard(d, card.id, card.column, index + 1))}>
            <ArrowDown aria-hidden="true" size={14} />
          </button>
          <button type="button" className="icon-btn small-btn" aria-label={`แก้ไข “${card.title}”`} onClick={() => setEditing({ id: card.id, title: card.title, note: card.note })}>
            <Pencil aria-hidden="true" size={14} />
          </button>
          <button
            type="button"
            className="icon-btn small-btn danger"
            aria-label={`ลบ “${card.title}”`}
            onClick={() => {
              if (window.confirm(`ลบ “${card.title}”?`)) setData((d) => removeCard(d, card.id));
            }}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </div>
      </li>
    );

  return (
    <div className="stack">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setData((d) => addCard(d, title, "todo", Date.now()));
          setTitle("");
        }}
      >
        <input className="input" aria-label="งานใหม่" placeholder="เพิ่มงานในช่อง “ต้องทำ”" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
          เพิ่ม
        </button>
      </form>
      <div className="kanban">
        {COLUMNS.map((col) => {
          const list = cardsIn(data, col.id);
          return (
            <section
              key={col.id}
              className={`kanban-column ${over === col.id ? "is-over" : ""}`}
              aria-labelledby={`kanban-${col.id}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              <h3 id={`kanban-${col.id}`}>
                {col.title} <span className="muted small">{list.length}</span>
              </h3>
              <ul className="stack" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {list.map((card, i) => renderCard(card, i, list))}
              </ul>
              {list.length === 0 && <p className="muted small empty-hint">ลากการ์ดมาวางที่นี่</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
