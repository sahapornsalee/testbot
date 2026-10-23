import { useState } from "react";
import { parseNumber } from "../converter/units";
import { ACTIVITY_LEVELS, bmi, energy, waterLiters, type Sex } from "./health";
import "./life.css";

export default function HealthWidget() {
  const [weight, setWeight] = useState("65");
  const [height, setHeight] = useState("170");
  const [ageYears, setAge] = useState("30");
  const [sex, setSex] = useState<Sex>("female");
  const [activity, setActivity] = useState<number>(ACTIVITY_LEVELS[1].factor);
  const w = parseNumber(weight);
  const h = parseNumber(height);
  const b = bmi(w, h);
  const e = energy(sex, w, h, parseNumber(ageYears), activity);

  return (
    <div className="stack">
      <div className="field-row">
        <label className="field">
          น้ำหนัก (กก.)
          <input className="input" inputMode="decimal" value={weight} onChange={(ev) => setWeight(ev.target.value)} />
        </label>
        <label className="field">
          ส่วนสูง (ซม.)
          <input className="input" inputMode="decimal" value={height} onChange={(ev) => setHeight(ev.target.value)} />
        </label>
      </div>
      {b.ok ? (
        <div className="result-box" role="status">
          <span className="muted small">BMI</span>
          <br />
          <span className="result-value">{b.value.bmi}</span> · <strong>{b.value.category}</strong>
          <br />
          <span className="muted small">
            น้ำหนักที่เหมาะสมสำหรับส่วนสูงนี้ {b.value.healthyMin}–{b.value.healthyMax} กก. · ควรดื่มน้ำประมาณ {waterLiters(w)} ลิตร/วัน
          </span>
        </div>
      ) : (
        <p className="error-text" role="alert">
          {b.error}
        </p>
      )}
      <details>
        <summary>พลังงานที่ร่างกายต้องการต่อวัน</summary>
        <div className="stack" style={{ marginTop: "var(--space-3)" }}>
          <div className="field-row">
            <label className="field">
              อายุ (ปี)
              <input className="input" inputMode="numeric" value={ageYears} onChange={(ev) => setAge(ev.target.value)} />
            </label>
            <label className="field">
              เพศ
              <select className="input" value={sex} onChange={(ev) => setSex(ev.target.value as Sex)}>
                <option value="female">หญิง</option>
                <option value="male">ชาย</option>
              </select>
            </label>
          </div>
          <label className="field">
            กิจกรรม
            <select className="input" value={activity} onChange={(ev) => setActivity(Number(ev.target.value))}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.factor} value={a.factor}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          {e.ok ? (
            <dl className="stat-grid">
              <div>
                <dt>BMR (ขณะพัก)</dt>
                <dd>{e.value.bmr.toLocaleString("th-TH")} kcal</dd>
              </div>
              <div>
                <dt>ต่อวัน (TDEE)</dt>
                <dd>{e.value.tdee.toLocaleString("th-TH")} kcal</dd>
              </div>
            </dl>
          ) : (
            <p className="error-text small">{e.error}</p>
          )}
        </div>
      </details>
      <p className="muted small">เกณฑ์ BMI สำหรับคนเอเชีย ใช้เป็นแนวทางเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์</p>
    </div>
  );
}
