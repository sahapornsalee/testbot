import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from "lucide-react";
import { taskRepository, type Task } from "../../data/models";
import { useCollection } from "../../hooks/useCollection";
import { createTask, filterTasks, moveTask, sortTasks, validateTitle, type TaskFilter } from "./tasks";
import "./tasks.css";

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "active", label: "ค้างอยู่" },
  { value: "done", label: "เสร็จแล้ว" },
];

export default function TasksWidget() {
  const { status, items, error, save, saveMany, remove } = useCollection(taskRepository);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  if (status === "loading") return <p className="muted">กำลังโหลดรายการงาน…</p>;
  if (status === "error") return <p className="error-text" role="alert">{error}</p>;

  const sorted = sortTasks(items);
  const visible = filterTasks(sorted, filter);
  const remaining = items.filter((t) => !t.done).length;
  const doneCount = items.length - remaining;

  const add = () => {
    const result = validateTitle(draft);
    if (!result.ok) {
      setInputError(result.error);
      return;
    }
    save(createTask(result.title, items, Date.now()));
    setDraft("");
    setInputError(null);
  };

  return (
    <div className="tasks">
      {error && <p className="notice" role="status">{error}</p>}
      <form
        className="tasks-add"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label htmlFor={inputId} className="visually-hidden">
          งานใหม่
        </label>
        <input
          id={inputId}
          className="input"
          placeholder="เพิ่มงานใหม่…"
          value={draft}
          maxLength={500}
          aria-invalid={inputError !== null}
          aria-describedby={inputError ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInputError(null);
          }}
        />
        <button type="submit" className="btn btn-primary">
          เพิ่ม
        </button>
      </form>
      {inputError && (
        <p id={errorId} className="error-text small" role="alert">
          {inputError}
        </p>
      )}

      <div className="tasks-toolbar">
        <div className="segmented" role="group" aria-label="กรองรายการ">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="muted small" role="status">
          ค้าง {remaining} · เสร็จ {doneCount}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีงาน เริ่มเพิ่มงานแรกได้เลย</p>
      ) : visible.length === 0 ? (
        <p className="muted empty-hint">ไม่มีงานในหมวดนี้</p>
      ) : (
        <ul className="task-list" aria-label="รายการงาน">
          {visible.map((task) =>
            editingId === task.id ? (
              <TaskEditor
                key={task.id}
                task={task}
                onSave={(title) => {
                  save({ ...task, title, updatedAt: Date.now() });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <li key={task.id} className={`task-item ${task.done ? "is-done" : ""}`}>
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => save({ ...task, done: !task.done, updatedAt: Date.now() })}
                  />
                  <span className="task-title">{task.title}</span>
                </label>
                <div className="task-actions">
                  {filter === "all" && (
                    <>
                      <button
                        type="button"
                        className="icon-btn small-btn"
                        aria-label={`เลื่อน "${task.title}" ขึ้น`}
                        disabled={sorted[0]?.id === task.id}
                        onClick={() => saveMany(moveTask(items, task.id, -1, Date.now()))}
                      >
                        <ArrowUp aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn small-btn"
                        aria-label={`เลื่อน "${task.title}" ลง`}
                        disabled={sorted[sorted.length - 1]?.id === task.id}
                        onClick={() => saveMany(moveTask(items, task.id, 1, Date.now()))}
                      >
                        <ArrowDown aria-hidden="true" size={16} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-btn small-btn"
                    aria-label={`แก้ไข "${task.title}"`}
                    onClick={() => setEditingId(task.id)}
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn small-btn danger"
                    aria-label={`ลบ "${task.title}"`}
                    onClick={() => remove(task.id)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {doneCount > 0 && (
        <button
          type="button"
          className="btn small"
          onClick={() => {
            if (window.confirm(`ลบงานที่เสร็จแล้ว ${doneCount} รายการ?`)) {
              items.filter((t) => t.done).forEach((t) => remove(t.id));
            }
          }}
        >
          ล้างงานที่เสร็จแล้ว
        </button>
      )}
    </div>
  );
}

function TaskEditor({ task, onSave, onCancel }: { task: Task; onSave: (title: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(task.title);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const result = validateTitle(value);
    if (result.ok) onSave(result.title);
    else setError(result.error);
  };
  return (
    <li className="task-item is-editing">
      <form
        className="task-edit"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          className="input"
          aria-label="แก้ไขชื่องาน"
          value={value}
          maxLength={500}
          autoFocus
          aria-invalid={error !== null}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
        />
        <button type="submit" className="icon-btn small-btn" aria-label="บันทึก">
          <Check aria-hidden="true" size={16} />
        </button>
        <button type="button" className="icon-btn small-btn" aria-label="ยกเลิก" onClick={onCancel}>
          <X aria-hidden="true" size={16} />
        </button>
      </form>
      {error && (
        <p className="error-text small" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
