import { useState } from "react";
import { Phone } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { EMERGENCY_KEY, EMERGENCY_NUMBERS, EMPTY_MEDICAL, parseMedical, telHref, type MedicalInfo } from "./emergency";
import "./life.css";

const FIELDS: { key: keyof Omit<MedicalInfo, "version">; label: string; multiline?: boolean }[] = [
  { key: "name", label: "ชื่อ-นามสกุล" },
  { key: "bloodType", label: "กรุ๊ปเลือด" },
  { key: "allergies", label: "แพ้ยา / แพ้อาหาร", multiline: true },
  { key: "conditions", label: "โรคประจำตัว", multiline: true },
  { key: "medications", label: "ยาที่ใช้ประจำ", multiline: true },
  { key: "contactName", label: "ผู้ติดต่อฉุกเฉิน" },
  { key: "contactPhone", label: "เบอร์ผู้ติดต่อฉุกเฉิน" },
];

export default function EmergencyWidget() {
  const [info, setInfo] = usePersistentState(EMERGENCY_KEY, parseMedical, EMPTY_MEDICAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(info);
  const filled = FIELDS.filter((f) => info[f.key].trim());
  const contactTel = telHref(info.contactPhone);

  return (
    <div className="stack">
      <ul className="emergency-list" aria-label="เบอร์ฉุกเฉิน">
        {EMERGENCY_NUMBERS.map((e) => (
          <li key={e.number} className="emergency-item">
            <a href={`tel:${e.number}`}>
              <strong>{e.number}</strong>
              <span>{e.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <section className="stack" aria-labelledby="medical-title">
        <h3 id="medical-title" className="settings-heading">
          ข้อมูลทางการแพทย์ของฉัน
        </h3>
        {editing ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              setInfo(draft);
              setEditing(false);
            }}
          >
            {FIELDS.map((f) => (
              <label key={f.key} className="field">
                {f.label}
                {f.multiline ? (
                  <textarea className="input" rows={2} maxLength={500} value={draft[f.key]} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                ) : (
                  <input
                    className="input"
                    maxLength={500}
                    inputMode={f.key === "contactPhone" ? "tel" : undefined}
                    value={draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                )}
              </label>
            ))}
            <div className="button-row">
              <button type="submit" className="btn btn-primary">
                บันทึก
              </button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                ยกเลิก
              </button>
            </div>
          </form>
        ) : filled.length === 0 ? (
          <p className="muted small">กรอกข้อมูลไว้ให้ผู้ช่วยเหลือดูได้ทันที แม้ไม่มีอินเทอร์เน็ต</p>
        ) : (
          <dl className="medical-card">
            {filled.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{info[f.key]}</dd>
              </div>
            ))}
          </dl>
        )}
        {!editing && (
          <div className="button-row">
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setDraft(info);
                setEditing(true);
              }}
            >
              {filled.length ? "แก้ไขข้อมูล" : "กรอกข้อมูล"}
            </button>
            {contactTel && (
              <a className="btn small btn-primary" href={contactTel}>
                <Phone aria-hidden="true" size={16} /> โทรหา{info.contactName || "ผู้ติดต่อ"}
              </a>
            )}
          </div>
        )}
        <p className="muted small">ข้อมูลเก็บเฉพาะในเครื่องนี้ ไม่ถูกส่งไปที่ใด ระวังการใช้บนอุปกรณ์ที่คนอื่นใช้ร่วม</p>
      </section>
    </div>
  );
}
