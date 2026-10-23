import { useState } from "react";
import { formatThaiDate, parseIsoDate, today } from "../calendar/dates";
import { age } from "./age";
import "./life.css";

export default function AgeWidget() {
  const [birth, setBirth] = useState("1995-01-01");
  const date = parseIsoDate(birth);
  const result = date ? age(date, today()) : null;

  return (
    <div className="stack">
      <label className="field">
        วันเกิด
        <input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
      </label>
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
          {date && <p className="muted small">เกิด{formatThaiDate(date)}</p>}
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
