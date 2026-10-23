import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { DateInput } from "../../components/DateInput";
import { usePersistentState } from "../../hooks/usePersistentState";
import { displayYear, formatDate } from "../../lib/datetime";
import { parseIsoDate, toIsoDate } from "../calendar/dates";
import { useDateTime } from "../settings/SettingsContext";
import { createCustomHoliday, EMPTY_HOLIDAYS, hasBuddhistData, HOLIDAYS_KEY, holidaysOfYear, parseHolidays } from "./holidays";
import "../life/life.css";

const KIND_LABEL = { official: "", buddhist: "", substitute: "ชดเชย", custom: "เพิ่มเอง", private: "เอกชน" } as const;

export default function HolidaysWidget() {
  const { locale, today } = useDateTime();
  const now = today();
  const [year, setYear] = useState(now.year);
  const [data, setData] = usePersistentState(HOLIDAYS_KEY, parseHolidays, EMPTY_HOLIDAYS);
  const [date, setDate] = useState(toIsoDate(now));
  const [name, setName] = useState("");
  const list = holidaysOfYear(year, data.custom);
  const todayIso = toIsoDate(now);
  const next = list.find((h) => h.date >= todayIso && h.kind !== "private");

  return (
    <div className="stack">
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="ปีก่อนหน้า" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <h3>วันหยุดปี {displayYear(year, locale)}</h3>
        <button type="button" className="icon-btn" aria-label="ปีถัดไป" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      {year === now.year && next && (
        <p className="result-box" role="status">
          วันหยุดถัดไป: <strong>{next.name}</strong> — {formatDate(parseIsoDate(next.date)!, locale)}
        </p>
      )}
      {!hasBuddhistData(year) && (
        <p className="notice small">ปีนี้ยังไม่มีข้อมูลวันหยุดทางพุทธศาสนาและวันหยุดพิเศษ (ขึ้นกับปฏิทินจันทรคติและประกาศ ครม.) เพิ่มเองได้ด้านล่าง</p>
      )}
      <ul className="event-list" aria-label={`วันหยุดปี ${displayYear(year, locale)}`}>
        {list.map((h, i) => (
          <li key={`${h.date}-${i}`} className="event-item">
            <div>
              {h.name}
              <small>
                {formatDate(parseIsoDate(h.date)!, locale)}
                {KIND_LABEL[h.kind] ? ` · ${KIND_LABEL[h.kind]}` : ""}
              </small>
            </div>
            <span />
            {h.kind === "custom" ? (
              <button
                type="button"
                className="icon-btn small-btn danger"
                aria-label={`ลบ ${h.name}`}
                onClick={() => setData((d) => ({ ...d, custom: d.custom.filter((c) => !(c.date === h.date && c.name === h.name)) }))}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const created = createCustomHoliday(date, name);
          if (!created) return;
          setData((d) => ({ ...d, custom: [...d.custom, created] }));
          setName("");
        }}
      >
        <h4 className="settings-heading">เพิ่มวันหยุดเอง (เช่น วันหยุดพิเศษ วันหยุดบริษัท)</h4>
        <DateInput label="วันที่" value={date} onChange={setDate} locale={locale} />
        <div className="inline-form">
          <input className="input" aria-label="ชื่อวันหยุด" placeholder="ชื่อวันหยุด" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            เพิ่ม
          </button>
        </div>
      </form>
      <p className="muted small">วันหยุดราชการตามวันที่คงที่ และวันหยุดชดเชยคำนวณตามหลักทั่วไป รัฐอาจประกาศเปลี่ยนแปลง ควรตรวจกับประกาศทางการ</p>
    </div>
  );
}
