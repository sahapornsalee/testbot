import { useState } from "react";
import { Trash2 } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { formatThaiDate, today, toIsoDate } from "../calendar/dates";
import { createEvent, daysUntil, EMPTY_EVENTS, EVENTS_KEY, MAX_EVENTS, nextOccurrence, parseEvents, sortEvents } from "./events";
import "./life.css";

export default function EventsWidget() {
  const [data, setData] = usePersistentState(EVENTS_KEY, parseEvents, EMPTY_EVENTS);
  const now = today();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toIsoDate(now));
  const [yearly, setYearly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const created = createEvent(title, date, yearly);
          if (!created) {
            setError("กรุณาใส่ชื่อและวันที่");
            return;
          }
          if (data.events.length >= MAX_EVENTS) {
            setError(`เพิ่มได้สูงสุด ${MAX_EVENTS} รายการ`);
            return;
          }
          setData((d) => ({ ...d, events: [...d.events, created] }));
          setTitle("");
          setError(null);
        }}
      >
        <div className="field-row">
          <label className="field">
            ชื่อเหตุการณ์
            <input className="input" maxLength={100} placeholder="เช่น วันสอบ, วันเกิดแม่" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            วันที่
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="button-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
            เกิดซ้ำทุกปี
          </label>
          <button type="submit" className="btn btn-primary">
            เพิ่ม
          </button>
        </div>
        {error && (
          <p className="error-text small" role="alert">
            {error}
          </p>
        )}
      </form>
      {data.events.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีวันสำคัญ</p>
      ) : (
        <ul className="event-list" aria-label="วันสำคัญ">
          {sortEvents(data.events, now).map((event) => {
            const days = daysUntil(event, now);
            return (
              <li key={event.id} className="event-item">
                <div>
                  {event.title}
                  <small>
                    {formatThaiDate(nextOccurrence(event, now))}
                    {event.yearly ? " · ทุกปี" : ""}
                  </small>
                </div>
                <span className={`event-days ${days === 0 ? "is-today" : ""}`}>
                  {days === 0 ? "วันนี้" : days > 0 ? `อีก ${days.toLocaleString("th-TH")} วัน` : `ผ่านมา ${(-days).toLocaleString("th-TH")} วัน`}
                </span>
                <button
                  type="button"
                  className="icon-btn small-btn danger"
                  aria-label={`ลบ ${event.title}`}
                  onClick={() => setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== event.id) }))}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
