import { useRef, useState, type DragEvent } from "react";
import { Check, Plus, RotateCcw, Settings2 } from "lucide-react";
import { WIDGETS } from "../../app/registry";
import { useElementWidth } from "../../hooks/useElementWidth";
import {
  addWidget,
  fillRows,
  moveWidget,
  removeWidget,
  resolveColumns,
  setColumns,
  setWidgetHidden,
  setWidgetSize,
  spanFor,
  type ColumnSetting,
} from "./layout";
import { useLayout } from "./LayoutContext";
import { ToolList } from "./ToolList";
import { WidgetFrame } from "./WidgetFrame";
import "./dashboard.css";

const COLUMN_OPTIONS: { value: ColumnSetting; label: string }[] = [
  { value: "auto", label: "อัตโนมัติ" },
  { value: 1, label: "1 คอลัมน์" },
  { value: 2, label: "2 คอลัมน์" },
  { value: 3, label: "3 คอลัมน์" },
  { value: 4, label: "4 คอลัมน์" },
];

export function Dashboard() {
  const { layout, update, reset } = useLayout();
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = resolveColumns(useElementWidth(gridRef), layout.columns);
  const dragId = useRef<string | null>(null);

  const entries = layout.items.flatMap((item) => {
    const widget = WIDGETS.find((w) => w.id === item.id);
    return widget ? [{ item, widget }] : [];
  });
  const shown = editing ? entries : entries.filter((e) => !e.item.hidden);
  // Fill every row completely so the cards tile without gaps.
  const spans = fillRows(
    shown.map(({ item }) => spanFor(item.size, columns)),
    columns,
  );
  const notOnDashboard = WIDGETS.filter((w) => !layout.items.some((i) => i.id === w.id));
  const hiddenCount = entries.length - entries.filter((e) => !e.item.hidden).length;

  const move = (id: string, title: string, toIndex: number) => {
    update((l) => moveWidget(l, id, toIndex));
    setAnnouncement(`ย้าย ${title} ไปตำแหน่งที่ ${Math.max(1, Math.min(entries.length, toIndex + 1))}`);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-widget-id="${id}"] .widget-edit button:not(:disabled)`)?.focus(),
    );
  };

  return (
    <>
      <div className="dashboard-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {editing ? "ลากหรือใช้ปุ่มลูกศรเพื่อจัดลำดับ ปรับขนาด ซ่อน หรือเพิ่มเครื่องมือ" : "เครื่องมือที่ปักหมุดไว้ กดดาวเพื่อเพิ่มหรือนำออก"}
          </p>
        </div>
        <button
          type="button"
          className={`btn ${editing ? "btn-primary" : ""}`}
          aria-pressed={editing}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? <Check aria-hidden="true" size={18} /> : <Settings2 aria-hidden="true" size={18} />}
          {editing ? "เสร็จสิ้น" : "ปรับแต่ง"}
        </button>
      </div>

      {editing && (
        <div className="card dashboard-toolbar">
          <label className="field inline-field">
            จำนวนคอลัมน์
            <select
              className="input"
              value={String(layout.columns)}
              onChange={(event) => {
                const value = event.target.value;
                update((l) => setColumns(l, value === "auto" ? "auto" : (Number(value) as ColumnSetting)));
              }}
            >
              {COLUMN_OPTIONS.map((o) => (
                <option key={o.label} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm("คืนค่า Dashboard เป็นค่าเริ่มต้น? ลำดับ ขนาด และการซ่อนจะถูกรีเซ็ต")) reset();
            }}
          >
            <RotateCcw aria-hidden="true" size={16} /> คืนค่าเริ่มต้น
          </button>
        </div>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <div ref={gridRef} className="dashboard-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shown.map(({ item, widget }, index) => (
          <WidgetFrame
            key={widget.id}
            widget={widget}
            style={{ gridColumn: `span ${spans[index] ?? 1}` }}
            {...(editing
              ? {
                  edit: {
                    index,
                    count: shown.length,
                    size: item.size,
                    hidden: item.hidden,
                    onMove: (to: number) => move(widget.id, widget.title, to),
                    onResize: (size) => update((l) => setWidgetSize(l, widget, size)),
                    onToggleHidden: () => update((l) => setWidgetHidden(l, widget.id, !item.hidden)),
                    onRemove: () => update((l) => removeWidget(l, widget.id)),
                    onDragStart: (event: DragEvent) => {
                      dragId.current = widget.id;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", widget.id);
                    },
                    onDrop: (event: DragEvent) => {
                      event.preventDefault();
                      const id = dragId.current ?? event.dataTransfer.getData("text/plain");
                      dragId.current = null;
                      if (id && id !== widget.id) move(id, WIDGETS.find((w) => w.id === id)?.title ?? id, index);
                    },
                  },
                }
              : {})}
          />
        ))}
      </div>

      {shown.length === 0 && (
        <div className="card empty-state">
          <h2>ยังไม่มีเครื่องมือบน Dashboard</h2>
          <p>
            {hiddenCount > 0
              ? `มีเครื่องมือที่ซ่อนอยู่ ${hiddenCount} รายการ กด “ปรับแต่ง” เพื่อแสดง`
              : "กด “ปรับแต่ง” เพื่อเพิ่มเครื่องมือ หรือเปิดเครื่องมือด้านล่างแล้วกดรูปดาว"}
          </p>
        </div>
      )}

      {notOnDashboard.length > 0 && (
        <section aria-labelledby="other-tools" className="other-tools">
          <h2 id="other-tools" className="section-title">
            {editing ? "เพิ่มเครื่องมือ" : "เครื่องมืออื่น"}
          </h2>
          {editing ? (
            <ul className="tool-list">
              {notOnDashboard.map((widget) => {
                const Icon = widget.icon;
                return (
                  <li key={widget.id}>
                    <button
                      type="button"
                      className="card tool-card add-card"
                      onClick={() => update((l) => addWidget(l, widget))}
                      aria-label={`เพิ่ม ${widget.title}`}
                    >
                      <Icon aria-hidden="true" size={22} />
                      <div>
                        <strong>{widget.title}</strong>
                        <span>{widget.description}</span>
                      </div>
                      <Plus aria-hidden="true" size={18} className="add-icon" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ToolList widgets={notOnDashboard} />
          )}
        </section>
      )}
    </>
  );
}
