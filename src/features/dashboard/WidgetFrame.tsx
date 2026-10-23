import { Suspense, type CSSProperties, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Maximize2, Star, X } from "lucide-react";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { hrefFor } from "../../app/router";
import type { WidgetDefinition, WidgetSize } from "../../types/widget";
import { hasWidget, toggleWidget } from "./layout";
import { useLayout } from "./LayoutContext";
import "./dashboard.css";

export interface EditControls {
  index: number;
  count: number;
  size: WidgetSize;
  hidden: boolean;
  onMove: (toIndex: number) => void;
  onResize: (size: WidgetSize) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

interface Props {
  widget: WidgetDefinition;
  /** Hide the "open full page" link when already on the tool page. */
  showOpenLink?: boolean;
  style?: CSSProperties;
  edit?: EditControls;
}

const SIZE_LABELS: Record<WidgetSize, string> = { small: "เล็ก", medium: "กลาง", large: "ใหญ่" };

export function WidgetFrame({ widget, showOpenLink = true, style, edit }: Props) {
  const { layout, update } = useLayout();
  const pinned = hasWidget(layout, widget.id);
  const Icon = widget.icon;
  const Content = widget.component;
  const headingId = `widget-${widget.id}-title`;

  return (
    <section
      className={`card widget ${edit ? "is-editing" : ""} ${edit?.hidden ? "is-hidden" : ""}`}
      style={style}
      aria-labelledby={headingId}
      draggable={edit ? true : undefined}
      onDragStart={edit?.onDragStart}
      onDragOver={edit ? (event) => event.preventDefault() : undefined}
      onDrop={edit?.onDrop}
      data-widget-id={widget.id}
    >
      <header className="widget-header">
        {edit ? <GripVertical aria-hidden="true" size={18} className="drag-handle" /> : <Icon aria-hidden="true" size={20} />}
        <h2 id={headingId} className="widget-title">
          {widget.title}
          {edit?.hidden && <span className="muted small"> (ซ่อนอยู่)</span>}
        </h2>
        {!edit && (
          <button
            type="button"
            className={`icon-btn ${pinned ? "is-favorite" : ""}`}
            aria-pressed={pinned}
            aria-label={pinned ? `นำ ${widget.title} ออกจาก Dashboard` : `ปักหมุด ${widget.title} ไว้ที่ Dashboard`}
            title={pinned ? "นำออกจาก Dashboard" : "ปักหมุดไว้ที่ Dashboard"}
            onClick={() => update((l) => toggleWidget(l, widget))}
          >
            <Star aria-hidden="true" size={18} fill={pinned ? "currentColor" : "none"} />
          </button>
        )}
        {showOpenLink && !edit && (
          <a
            className="icon-btn"
            href={hrefFor({ name: "tool", id: widget.id })}
            aria-label={`เปิด ${widget.title} แบบเต็มหน้า`}
            title="เปิดแบบเต็มหน้า"
          >
            <Maximize2 aria-hidden="true" size={18} />
          </a>
        )}
      </header>
      {edit ? (
        <div className="widget-edit" role="group" aria-label={`จัดการ ${widget.title}`}>
          <div className="button-row">
            <button
              type="button"
              className="icon-btn small-btn"
              aria-label={`ย้าย ${widget.title} ไปก่อนหน้า`}
              disabled={edit.index === 0}
              onClick={() => edit.onMove(edit.index - 1)}
            >
              <ArrowUp aria-hidden="true" size={16} />
            </button>
            <button
              type="button"
              className="icon-btn small-btn"
              aria-label={`ย้าย ${widget.title} ไปถัดไป`}
              disabled={edit.index === edit.count - 1}
              onClick={() => edit.onMove(edit.index + 1)}
            >
              <ArrowDown aria-hidden="true" size={16} />
            </button>
            {widget.supportsResize && (
              <label className="inline-size">
                <span className="visually-hidden">ขนาดของ {widget.title}</span>
                <select
                  className="input"
                  value={edit.size}
                  onChange={(event) => edit.onResize(event.target.value as WidgetSize)}
                >
                  {(Object.keys(SIZE_LABELS) as WidgetSize[]).map((size) => (
                    <option key={size} value={size}>
                      ขนาด{SIZE_LABELS[size]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="icon-btn small-btn"
              aria-label={edit.hidden ? `แสดง ${widget.title}` : `ซ่อน ${widget.title}`}
              aria-pressed={edit.hidden}
              onClick={edit.onToggleHidden}
            >
              {edit.hidden ? <Eye aria-hidden="true" size={16} /> : <EyeOff aria-hidden="true" size={16} />}
            </button>
            <button
              type="button"
              className="icon-btn small-btn danger"
              aria-label={`นำ ${widget.title} ออกจาก Dashboard`}
              onClick={edit.onRemove}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          <p className="muted small">{widget.description}</p>
        </div>
      ) : (
        <div className="widget-body">
          <ErrorBoundary label={widget.title}>
            <Suspense fallback={<p className="widget-loading">กำลังโหลด…</p>}>
              <Content />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </section>
  );
}
