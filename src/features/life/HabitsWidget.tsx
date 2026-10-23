import { useState } from "react";
import { Flame, Trash2 } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { weekdayNames } from "../../lib/datetime";
import { sameDate, toIsoDate } from "../calendar/dates";
import { useDateTime } from "../settings/SettingsContext";
import { addHabit, currentStreak, EMPTY_HABITS, HABITS_KEY, lastDays, longestStreak, MAX_HABITS, parseHabits, removeHabit, toggleDay } from "./habits";
import "./life.css";

export default function HabitsWidget() {
  const [data, setData] = usePersistentState(HABITS_KEY, parseHabits, EMPTY_HABITS);
  const [name, setName] = useState("");
  const { locale, today } = useDateTime();
  const now = today();
  const days = lastDays(now, 7);
  const weekday = weekdayNames(locale);

  return (
    <div className="stack">
      <form
        className="tasks-add"
        onSubmit={(event) => {
          event.preventDefault();
          setData((d) => addHabit(d, name, Date.now()));
          setName("");
        }}
      >
        <input className="input" aria-label="นิสัยใหม่" placeholder="เช่น ดื่มน้ำ 8 แก้ว, อ่านหนังสือ" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || data.habits.length >= MAX_HABITS}>
          เพิ่ม
        </button>
      </form>
      {data.habits.length === 0 ? (
        <p className="muted empty-hint">ยังไม่มีนิสัยที่ติดตาม เพิ่มสิ่งที่อยากทำทุกวันได้เลย</p>
      ) : (
        <ul className="habit-grid" aria-label="นิสัยที่ติดตาม">
          {data.habits.map((habit) => {
            const streak = currentStreak(habit, now);
            return (
              <li key={habit.id} className="habit-row">
                <div className="habit-name">
                  {habit.name}
                  <small>
                    <Flame aria-hidden="true" size={12} /> ต่อเนื่อง {streak} วัน · สูงสุด {longestStreak(habit)} วัน
                  </small>
                </div>
                <div className="habit-days" role="group" aria-label={`7 วันล่าสุดของ ${habit.name}`}>
                  {days.map((day) => {
                    const done = habit.done.includes(toIsoDate(day));
                    const label = `${weekday[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()]} ${day.day}`;
                    return (
                      <button
                        key={toIsoDate(day)}
                        type="button"
                        className={`habit-day ${sameDate(day, now) ? "is-today" : ""}`}
                        aria-pressed={done}
                        aria-label={`${habit.name} ${label}${sameDate(day, now) ? " (วันนี้)" : ""}`}
                        title={label}
                        onClick={() => setData((d) => toggleDay(d, habit.id, day))}
                      >
                        {day.day}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="icon-btn small-btn danger"
                  aria-label={`ลบ ${habit.name}`}
                  onClick={() => {
                    if (window.confirm(`ลบ “${habit.name}” และประวัติทั้งหมด?`)) setData((d) => removeHabit(d, habit.id));
                  }}
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
