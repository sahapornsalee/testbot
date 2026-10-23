import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { usePersistentState } from "../../hooks/usePersistentState";
import { createPrompt, DEFAULT_PROMPTS, fillTemplate, MAX_PROMPTS, parsePrompts, placeholders, PROMPTS_KEY } from "./prompts";
import "./ai-tools.css";

export default function PromptsWidget() {
  const [data, setData] = usePersistentState(PROMPTS_KEY, parsePrompts, DEFAULT_PROMPTS);
  const [selectedId, setSelectedId] = useState<string | null>(data.prompts[0]?.id ?? null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const [copyState, copy] = useCopy();
  const selected = data.prompts.find((p) => p.id === selectedId) ?? null;
  const filled = selected ? fillTemplate(selected.body, values) : "";

  return (
    <div className="prompt-layout">
      <div className="stack">
        <ul className="prompt-list" aria-label="คำสั่งที่บันทึกไว้">
          {data.prompts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-current={p.id === selectedId ? "true" : undefined}
                onClick={() => {
                  setSelectedId(p.id);
                  setValues({});
                  setEditing(null);
                }}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
        <div className="button-row">
          <button type="button" className="btn small" disabled={data.prompts.length >= MAX_PROMPTS} onClick={() => setEditing({ id: null, title: "", body: "" })}>
            <Plus aria-hidden="true" size={14} /> เพิ่มคำสั่ง
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              if (window.confirm("คืนค่าคำสั่งตัวอย่าง? คำสั่งที่คุณเพิ่มเองจะยังอยู่")) {
                setData((d) => ({ ...d, prompts: [...DEFAULT_PROMPTS.prompts.filter((p) => !d.prompts.some((x) => x.id === p.id)), ...d.prompts] }));
              }
            }}
          >
            <RotateCcw aria-hidden="true" size={14} /> คืนค่าตัวอย่าง
          </button>
        </div>
      </div>

      <div className="stack">
        {editing ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing.id) {
                setData((d) => ({ ...d, prompts: d.prompts.map((p) => (p.id === editing.id ? { ...p, title: editing.title.trim() || p.title, body: editing.body } : p)) }));
              } else {
                const created = createPrompt(editing.title, editing.body);
                if (!created) return;
                setData((d) => ({ ...d, prompts: [...d.prompts, created] }));
                setSelectedId(created.id);
              }
              setEditing(null);
            }}
          >
            <label className="field">
              ชื่อคำสั่ง
              <input className="input" required maxLength={100} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <label className="field">
              เนื้อหา (ใส่ {"{{ชื่อช่อง}}"} ตรงที่ต้องการกรอกทีหลัง)
              <textarea className="input" rows={8} required value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </label>
            <div className="button-row">
              <button type="submit" className="btn btn-primary">
                บันทึก
              </button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                ยกเลิก
              </button>
            </div>
          </form>
        ) : selected ? (
          <>
            <h3 className="settings-heading">{selected.title}</h3>
            {placeholders(selected.body).map((name) => (
              <label key={name} className="field">
                {name}
                <textarea className="input" rows={name.includes("เนื้อหา") || name.includes("ข้อความ") ? 4 : 1} value={values[name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} />
              </label>
            ))}
            <textarea className="input" rows={6} readOnly aria-label="คำสั่งที่พร้อมใช้" value={filled} />
            <div className="button-row">
              <button type="button" className="btn btn-primary" onClick={() => copy(filled)}>
                {COPY_LABEL[copyState]}
              </button>
              <button type="button" className="btn" onClick={() => setEditing({ id: selected.id, title: selected.title, body: selected.body })}>
                แก้ไข
              </button>
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`ลบคำสั่ง ${selected.title}`}
                onClick={() => {
                  if (!window.confirm(`ลบคำสั่ง “${selected.title}”?`)) return;
                  setData((d) => ({ ...d, prompts: d.prompts.filter((p) => p.id !== selected.id) }));
                  setSelectedId(data.prompts.find((p) => p.id !== selected.id)?.id ?? null);
                }}
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          </>
        ) : (
          <p className="muted">ยังไม่มีคำสั่ง กด “เพิ่มคำสั่ง”</p>
        )}
      </div>
    </div>
  );
}
