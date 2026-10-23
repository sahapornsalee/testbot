import { useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateInput } from "../../components/DateInput";
import { displayYear, formatDate, monthName, weekdayNames, type DateLocale } from "../../lib/datetime";
import { useDateTime } from "../settings/SettingsContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import { EMPTY_HOLIDAYS, HOLIDAYS_KEY, holidaysOfYear, parseHolidays } from "../thai/holidays";
import { addDays, addMonths, daysBetween, diffParts, monthGrid, parseIsoDate, sameDate, toIsoDate, type CalendarDate } from "./dates";
import "./calendar.css";

export default function CalendarWidget() {
  const { locale, today } = useDateTime();
  const now = today();
  const [view, setView] = useState({ year: now.year, month: now.month });
  const [selected, setSelected] = useState<CalendarDate>(now);
  const grid = monthGrid(view.year, view.month);
  const weekdays = weekdayNames(locale);
  const [holidayData] = usePersistentState(HOLIDAYS_KEY, parseHolidays, EMPTY_HOLIDAYS);
  const holidays = new Map<string, string>();
  for (const y of new Set(grid.map((c) => c.date.year))) {
    for (const h of holidaysOfYear(y, holidayData.custom)) if (h.kind !== "private") holidays.set(h.date, holidays.has(h.date) ? `${holidays.get(h.date)}, ${h.name}` : h.name);
  }
  const monthHolidays = [...holidays].filter(([d]) => d.startsWith(`${view.year}-${String(view.month).padStart(2, "0")}`));

  const go = (delta: number) => setView((v) => addMonths(v.year, v.month, delta));

  const focusDay = (date: CalendarDate) => {
    setSelected(date);
    if (date.month !== view.month || date.year !== view.year) setView({ year: date.year, month: date.month });
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-date="${toIsoDate(date)}"]`)?.focus());
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    focusDay(addDays(selected, delta));
  };

  return (
    <div className="calendar stack">
      <div className="calendar-header">
        <button type="button" className="icon-btn" aria-label="เดือนก่อนหน้า" onClick={() => go(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <h3 className="calendar-title" aria-live="polite">
          {monthName(view.month, locale)} {displayYear(view.year, locale)}
          {locale === "th" && <span className="muted small"> (ค.ศ. {view.year})</span>}
        </h3>
        <button type="button" className="icon-btn" aria-label="เดือนถัดไป" onClick={() => go(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div className="button-row calendar-today">
        <button
          type="button"
          className="btn small"
          onClick={() => {
            setView({ year: now.year, month: now.month });
            setSelected(now);
          }}
        >
          วันนี้
        </button>
        <span className="muted small">{formatDate(selected, locale)}</span>
      </div>
      <table className="calendar-grid" role="grid" aria-label={`ปฏิทิน ${monthName(view.month, locale)} ${displayYear(view.year, locale)}`}>
        <thead>
          <tr>
            {weekdays.map((name, i) => (
              <th key={i} scope="col" className={i === 0 ? "is-sunday" : undefined}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {grid.slice(week * 7, week * 7 + 7).map(({ date, inMonth }) => {
                const isSelected = sameDate(date, selected);
                return (
                  <td key={toIsoDate(date)}>
                    <button
                      type="button"
                      data-date={toIsoDate(date)}
                      className={`calendar-day ${inMonth ? "" : "is-outside"} ${sameDate(date, now) ? "is-today" : ""} ${holidays.has(toIsoDate(date)) ? "is-holiday" : ""}`}
                      title={holidays.get(toIsoDate(date))}
                      aria-pressed={isSelected}
                      aria-current={sameDate(date, now) ? "date" : undefined}
                      aria-label={`${formatDate(date, locale)}${holidays.has(toIsoDate(date)) ? ` (วันหยุด: ${holidays.get(toIsoDate(date))})` : ""}`}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setSelected(date)}
                    >
                      {date.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {monthHolidays.length > 0 && (
        <ul className="holiday-list" aria-label="วันหยุดในเดือนนี้">
          {monthHolidays.map(([d, name]) => (
            <li key={d}>
              <strong>{Number(d.slice(8))}</strong> {name}
            </li>
          ))}
        </ul>
      )}
      <DateCalculator initial={now} locale={locale} />
    </div>
  );
}

function DateCalculator({ initial, locale }: { initial: CalendarDate; locale: DateLocale }) {
  const [start, setStart] = useState(toIsoDate(initial));
  const [end, setEnd] = useState(toIsoDate(addDays(initial, 30)));
  const [offset, setOffset] = useState("30");
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  const days = Number(offset);
  const offsetValid = offset.trim() !== "" && Number.isInteger(days) && Math.abs(days) <= 100_000;

  return (
    <details className="date-calc" open>
      <summary>คำนวณวันที่</summary>
      <div className="stack">
        <div className="field-row">
          <DateInput label="ตั้งแต่วันที่" value={start} onChange={setStart} locale={locale} />
          <DateInput label="ถึงวันที่" value={end} onChange={setEnd} locale={locale} />
        </div>
        <div className="result-box" role="status">
          {from && to ? (
            <>
              <span className="result-value">{Math.abs(daysBetween(from, to)).toLocaleString("th-TH")} วัน</span>
              <br />
              <span className="muted small">
                {(() => {
                  const p = diffParts(from, to);
                  return `${p.years} ปี ${p.months} เดือน ${p.days} วัน · นับรวมวันแรกและวันสุดท้าย ${(Math.abs(daysBetween(from, to)) + 1).toLocaleString("th-TH")} วัน`;
                })()}
              </span>
            </>
          ) : (
            <span className="error-text">กรุณาเลือกวันที่ให้ครบ</span>
          )}
        </div>
        <div className="field-row">
          <label className="field">
            บวก/ลบจำนวนวันจาก “ตั้งแต่วันที่”
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={offset}
              aria-invalid={!offsetValid}
              onChange={(e) => setOffset(e.target.value)}
            />
          </label>
        </div>
        <div className="result-box" role="status">
          {from && offsetValid ? (
            <span>
              ผลลัพธ์: <strong>{formatDate(addDays(from, days), locale)}</strong>
            </span>
          ) : (
            <span className="error-text">กรุณาใส่จำนวนวันเป็นจำนวนเต็ม (ไม่เกิน ±100,000)</span>
          )}
        </div>
      </div>
    </details>
  );
}
