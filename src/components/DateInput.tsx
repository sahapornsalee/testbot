import { useId, useState } from "react";
import { daysInMonth, parseIsoDate, toIsoDate } from "../features/calendar/dates";
import { displayYear, fromDisplayYear, monthName, type DateLocale } from "../lib/datetime";
import "./date-input.css";

interface Props {
  label: string;
  /** ISO date "YYYY-MM-DD" (Common era). */
  value: string;
  onChange: (iso: string) => void;
  locale: DateLocale;
}

const MIN_YEAR = 1800;
const MAX_YEAR = 2400;

/**
 * Date entry in the app's chosen format instead of the browser's own
 * (which follows the device language, e.g. US month/day order).
 * Thai shows the year in the Buddhist era; the value is always ISO.
 */
export function DateInput({ label, value, onChange, locale }: Props) {
  const parsed = parseIsoDate(value) ?? { year: 2000, month: 1, day: 1 };
  const [yearText, setYearText] = useState(String(displayYear(parsed.year, locale)));
  const [lastValue, setLastValue] = useState(value);
  const [lastLocale, setLastLocale] = useState(locale);
  const id = useId();

  // Keep the year box in sync when the value or era changes from outside.
  if (value !== lastValue || locale !== lastLocale) {
    setLastValue(value);
    setLastLocale(locale);
    setYearText(String(displayYear(parsed.year, locale)));
  }

  const emit = (year: number, month: number, day: number) => {
    const next = toIsoDate({ year, month, day: Math.min(day, daysInMonth(year, month)) });
    setLastValue(next);
    onChange(next);
  };

  const yearNumber = Number(yearText);
  const gregorian = fromDisplayYear(yearNumber, locale);
  const yearValid = Number.isInteger(yearNumber) && gregorian >= MIN_YEAR && gregorian <= MAX_YEAR;
  const day = <select
    key="day"
    className="input"
    aria-label={`${label}: วัน`}
    value={parsed.day}
    onChange={(e) => emit(parsed.year, parsed.month, Number(e.target.value))}
  >
    {Array.from({ length: daysInMonth(parsed.year, parsed.month) }, (_, i) => (
      <option key={i + 1} value={i + 1}>
        {i + 1}
      </option>
    ))}
  </select>;
  const month = <select
    key="month"
    className="input"
    aria-label={`${label}: เดือน`}
    value={parsed.month}
    onChange={(e) => emit(parsed.year, Number(e.target.value), parsed.day)}
  >
    {Array.from({ length: 12 }, (_, i) => (
      <option key={i + 1} value={i + 1}>
        {monthName(i + 1, locale)}
      </option>
    ))}
  </select>;

  return (
    <fieldset className="date-input" aria-describedby={yearValid ? undefined : `${id}-error`}>
      <legend>{label}</legend>
      <div className="date-input-row">
        {day}
        {month}
        <input
          className="input date-input-year"
          inputMode="numeric"
          aria-label={`${label}: ปี${locale === "th" ? " (พ.ศ.)" : ""}`}
          aria-invalid={!yearValid}
          value={yearText}
          onChange={(e) => {
            const text = e.target.value.replace(/\D/g, "").slice(0, 4);
            setYearText(text);
            const y = fromDisplayYear(Number(text), locale);
            if (text.length === 4 && y >= MIN_YEAR && y <= MAX_YEAR) emit(y, parsed.month, parsed.day);
          }}
        />
      </div>
      {!yearValid && (
        <span id={`${id}-error`} className="error-text small">
          ปีไม่ถูกต้อง{locale === "th" ? " (ใช้ พ.ศ. เช่น 2569)" : ""}
        </span>
      )}
    </fieldset>
  );
}
