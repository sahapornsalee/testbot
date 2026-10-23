import { useState } from "react";
import { DateInput } from "../../components/DateInput";
import { formatDate } from "../../lib/datetime";
import { parseIsoDate } from "../calendar/dates";
import { useDateTime } from "../settings/SettingsContext";
import { age } from "./age";
import "./life.css";

export default function AgeWidget() {
  const { locale, today } = useDateTime();
  const [birth, setBirth] = useState("1995-01-01");
  const date = parseIsoDate(birth);
  const result = date ? age(date, today()) : null;

  return (
    <div className="stack">
      <DateInput label="วันเกิด" value={birth} onChange={setBirth} locale={locale} />
      {!result ? (
        <p className="muted">เลือกวันเกิด</p>
      ) : result.ok ? (
        <>
          <p className="big-number" role="status">
            {result.value.years} ปี {result.value.months} เดือน {result.value.days} วัน
          </p>
          <dl className="stat-grid">
            <div>
              <dt>มีชีวิตมาแล้ว</dt>
              <dd>{result.value.totalDays.toLocaleString("th-TH")} วัน</dd>
            </div>
            <div>
              <dt>วันเกิดครั้งถัดไป</dt>
              <dd>{result.value.daysToBirthday === 0 ? "วันนี้! 🎂" : `อีก ${result.value.daysToBirthday} วัน`}</dd>
            </div>
            <div>
              <dt>จะอายุ</dt>
              <dd>{result.value.nextBirthdayAge} ปี</dd>
            </div>
            <div>
              <dt>ปีนักษัตร</dt>
              <dd>{result.value.animal}</dd>
            </div>
          </dl>
          {date && <p className="muted small">เกิด{formatDate(date, locale)}</p>}
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
