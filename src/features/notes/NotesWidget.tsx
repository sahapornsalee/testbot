import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import { MAX_NOTE_LENGTH, noteRepository, type Note } from "../../data/models";
import { useCollection } from "../../hooks/useCollection";
import { createNote, displayTitle, excerpt, formatUpdated, searchNotes } from "./notes";
import "./notes.css";

const AUTOSAVE_DELAY_MS = 600;

export default function NotesWidget() {
  const { status, items, error, save, remove } = useCollection(noteRepository);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchId = useId();

  if (status === "loading") return <p className="muted">กำลังโหลดบันทึก…</p>;
  if (status === "error") return <p className="error-text" role="alert">{error}</p>;

  const selected = items.find((n) => n.id === selectedId) ?? null;
  const results = searchNotes(items, query);

  const add = () => {
    const note = createNote(Date.now());
    save(note);
    setSelectedId(note.id);
    setQuery("");
  };

  return (
    <div className={`notes ${selected ? "has-selection" : ""}`}>
      {error && <p className="notice notes-notice" role="status">{error}</p>}
      <div className="notes-sidebar">
        <div className="notes-search">
          <label htmlFor={searchId} className="visually-hidden">
            ค้นหาบันทึก
          </label>
          <Search aria-hidden="true" size={16} className="notes-search-icon" />
          <input
            id={searchId}
            type="search"
            className="input"
            placeholder="ค้นหาบันทึก…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={add}>
            <Plus aria-hidden="true" size={16} /> ใหม่
          </button>
        </div>
        {items.length === 0 ? (
          <p className="muted empty-hint">ยังไม่มีบันทึก กด “ใหม่” เพื่อเริ่มจด</p>
        ) : results.length === 0 ? (
          <p className="muted empty-hint" role="status">
            ไม่พบบันทึกที่ตรงกับ “{query}”
          </p>
        ) : (
          <ul className="note-list" aria-label="รายการบันทึก">
            {results.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="note-list-item"
                  aria-current={note.id === selectedId ? "true" : undefined}
                  onClick={() => setSelectedId(note.id)}
                >
                  <strong>{displayTitle(note)}</strong>
                  <span>{excerpt(note.body) || "ไม่มีเนื้อหา"}</span>
                  <small>{formatUpdated(note.updatedAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="notes-editor-pane">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onSave={save}
            onBack={() => setSelectedId(null)}
            onDelete={() => {
              if (window.confirm(`ลบบันทึก “${displayTitle(selected)}”? การลบนี้ย้อนกลับไม่ได้`)) {
                remove(selected.id);
                setSelectedId(null);
              }
            }}
          />
        ) : (
          <p className="muted notes-placeholder">เลือกบันทึกจากรายการ หรือสร้างบันทึกใหม่</p>
        )}
      </div>
    </div>
  );
}

interface EditorProps {
  note: Note;
  onSave: (note: Note) => void;
  onBack: () => void;
  onDelete: () => void;
}

function NoteEditor({ note, onSave, onBack, onDelete }: EditorProps) {
  const [draft, setDraft] = useState({ title: note.title, body: note.body });
  const [saved, setSaved] = useState(true);
  const latest = useRef({ draft, saved, note, onSave });
  useLayoutEffect(() => {
    latest.current = { draft, saved, note, onSave };
  });

  const flush = () => {
    const { draft: d, saved: s, note: n, onSave: save } = latest.current;
    if (s) return;
    save({ ...n, ...d, updatedAt: Date.now() });
    setSaved(true);
  };

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (saved) return;
    const id = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [draft, saved]);

  // Save pending edits when switching notes or leaving the page.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      const { draft: d, saved: s, note: n, onSave: save } = latest.current;
      if (!s) save({ ...n, ...d, updatedAt: Date.now() });
    };
  }, []);

  const change = (patch: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  return (
    <div className="note-editor">
      <div className="note-editor-bar">
        <button type="button" className="btn small notes-back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" size={16} /> รายการ
        </button>
        <span className="muted small" role="status" aria-live="polite">
          {saved ? "บันทึกอัตโนมัติแล้ว" : "กำลังบันทึก…"}
        </span>
        <button type="button" className="icon-btn danger" aria-label="ลบบันทึกนี้" onClick={onDelete}>
          <Trash2 aria-hidden="true" size={18} />
        </button>
      </div>
      <input
        className="input note-title"
        aria-label="ชื่อบันทึก"
        placeholder="ชื่อบันทึก"
        maxLength={500}
        value={draft.title}
        onChange={(event) => change({ title: event.target.value })}
        onBlur={flush}
      />
      <textarea
        className="input note-body"
        aria-label="เนื้อหาบันทึก"
        placeholder="เริ่มพิมพ์…"
        maxLength={MAX_NOTE_LENGTH}
        value={draft.body}
        onChange={(event) => change({ body: event.target.value })}
        onBlur={flush}
      />
    </div>
  );
}
