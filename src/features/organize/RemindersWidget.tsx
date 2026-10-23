import { useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { DateInput } from "../../components/DateInput";
import { useNow } from "../../hooks/useNow";
import { formatDate, formatTime, todayIn, zonedTimeToInstant } from "../../lib/datetime";
import { parseIsoDate, toIsoDate } from "../calendar/dates";
import { useDateTime, useSettings } from "../settings/SettingsContext";
import { createReminder, MAX_REMINDERS, setDone, sortReminders } from "./reminders";
import { useReminders } from "./RemindersContext";
import "./organize.css";

function describe(at: number, now: number): string {
  const minutes = Math.round((at - now) / 60_000);
  if (minutes < 0) return `เลยมา ${Math.abs(minutes) < 60 ? `${Math.abs(minutes)} นาที` : `${Math.round(Math.abs(minutes) / 60)} ชม.`}`;
  if (minutes < 60) return `อีก ${minutes} นาที`;
  if (minutes < 60 * 48) return `อีก ${Math.round(minutes / 60)} ชม.`;
  return `อีก ${Math.round(minutes / 1440)} วัน`;
}

export default function RemindersWidget() {
  const { data, update } = useReminders();
  const { settings } = useSettings();
  const dateTime = useDateTime();
  const now = useNow(30_000);
  const start = new Date(now + 60 * 60_000);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toIsoDate(todayIn(dateTime.timeZone, start)));
  const [hour, setHour] = useState(() => Number(formatTime(start, dateTime, false, false).slice(0, 2)) || 9);
  const [minute, setMinute] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

  const add = () => {
    const day = parseIsoDate(date);
    if (!day) return setError("กรุณาเลือกวันที่");
    const reminder = createReminder(title, zonedTimeToInstant(day, hour, minute, dateTime.timeZone));
    if (!reminder) return setError("กรุณาใส่เรื่องที่จะเตือน");
    if (reminder.at <= Date.now()) return setError("เวลานี้ผ่านไปแล้ว");
    if (data.reminders.length >= MAX_REMINDERS) return setError(`เพิ่มได้สูงสุด ${MAX_REMINDERS} รายการ`);
    update((d) => ({ ...d, reminders: [...d.reminders, reminder] }));
    setTitle("");
    setError(null);
  };

  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="field">
          เตือนเรื่อง
          <input className="input" maxLength={200} placeholder="เช่น โทรหาลูกค้า, กินยา" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="field-row">
          <DateInput label="วันที่" value={date} onChange={setDate} locale={dateTime.locale} />
          <fieldset className="date-input">
            <legend>เวลา</legend>
            <div className="time-select">
              <select className="input" aria-label="ชั่วโมง" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span>:</span>
              <select className="input" aria-label="นาที" value={minute} onChange={(e) => setMinute(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        </div>
        {error && (
          <p className="error-text small" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" style={{ justifySelf: "start" }}>
          <Bell aria-hidden="true" size={16} /> ตั้งเตือน
        </button>
      </form>

      {permission === "default" && (
        <p className="notice small">
          ให้เบราว์เซอร์แสดงการแจ้งเตือนด้วยไหม{" "}
          <button type="button" className="btn small" onClick={() => void Notification.requestPermission().then(setPermission)}>
            อนุญาตการแจ้งเตือน
          </button>
        </p>
      )}

      {data.reminders.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีการเตือน</p>
      ) : (
        <ul className="event-list" aria-label="รายการเตือน">
          {sortReminders(data.reminders).map((r) => (
            <li key={r.id} className={`reminder-item ${r.done ? "is-done" : ""} ${!r.done && r.at < now ? "is-overdue" : ""}`}>
              <input type="checkbox" aria-label={`ทำ “${r.title}” แล้ว`} checked={r.done} onChange={(e) => update((d) => setDone(d, r.id, e.target.checked))} />
              <div>
                {r.title}
                <small>
                  {formatDate(todayIn(dateTime.timeZone, new Date(r.at)), dateTime.locale, "medium")} {formatTime(new Date(r.at), dateTime, settings.timeFormat === "12h", false)}
                  {!r.done && ` · ${describe(r.at, now)}`}
                </small>
              </div>
              <button type="button" className="icon-btn small-btn danger" aria-label={`ลบ ${r.title}`} onClick={() => update((d) => ({ ...d, reminders: d.reminders.filter((x) => x.id !== r.id) }))}>
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">เตือนได้เฉพาะตอนที่เปิดเว็บนี้ไว้ (หน้าไหนก็ได้) ถ้าปิดเว็บ จะเตือนทันทีที่เปิดกลับมา</p>
    </div>
  );
}
