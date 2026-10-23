import { useState } from "react";
import { parseNumber } from "../converter/units";
import { formatBaht } from "../money/expenses";
import { calculateTax, type TaxInput } from "./tax";
import "../money/money.css";

type NumberField = Exclude<keyof TaxInput, "spouse">;

const FIELDS: { key: NumberField; label: string; hint?: string }[] = [
  { key: "salary", label: "เงินเดือน+โบนัสทั้งปี (บาท)" },
  { key: "withheld", label: "ภาษีที่ถูกหัก ณ ที่จ่ายแล้ว" },
  { key: "socialSecurity", label: "เงินสมทบประกันสังคมที่จ่ายจริง" },
  { key: "children", label: "จำนวนบุตร" },
  { key: "childrenBornFrom2561", label: "บุตรคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561" },
  { key: "parents", label: "บิดามารดาที่อุปการะ (อายุ 60+, สูงสุด 4)" },
  { key: "lifeInsurance", label: "เบี้ยประกันชีวิต (≤100,000)" },
  { key: "healthInsurance", label: "เบี้ยประกันสุขภาพ (≤25,000)" },
  { key: "retirement", label: "PVD/RMF/SSF/Thai ESG ฯลฯ รวม (≤500,000)" },
  { key: "homeLoanInterest", label: "ดอกเบี้ยบ้าน (≤100,000)" },
  { key: "other", label: "ลดหย่อนอื่น ๆ" },
];

export default function TaxWidget() {
  const [values, setValues] = useState<Record<NumberField, string>>({
    salary: "600000",
    withheld: "",
    socialSecurity: "9000",
    children: "",
    childrenBornFrom2561: "",
    parents: "",
    lifeInsurance: "",
    healthInsurance: "",
    retirement: "",
    homeLoanInterest: "",
    other: "",
  });
  const [spouse, setSpouse] = useState(false);
  const num = (s: string) => (s.trim() === "" ? 0 : parseNumber(s));
  const result = calculateTax({ ...(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, num(v)])) as Record<NumberField, number>), spouse });

  return (
    <div className="stack">
      <div className="field-row">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            {f.label}
            <input className="input" inputMode="decimal" value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={spouse} onChange={(e) => setSpouse(e.target.checked)} />
        มีคู่สมรสที่ไม่มีเงินได้
      </label>
      {result.ok ? (
        <>
          <dl className="stat-grid" aria-live="polite">
            <div>
              <dt>เงินได้สุทธิ</dt>
              <dd>{formatBaht(result.value.netIncome)}</dd>
            </div>
            <div>
              <dt>ภาษีทั้งปี</dt>
              <dd>{formatBaht(result.value.tax)}</dd>
            </div>
            <div>
              <dt>อัตราภาษีจริง</dt>
              <dd>{result.value.effectiveRate}%</dd>
            </div>
            <div>
              <dt>{result.value.balance >= 0 ? "ต้องจ่ายเพิ่ม" : "ได้คืน"}</dt>
              <dd className={result.value.balance > 0 ? "amount-expense" : "amount-income"}>{formatBaht(Math.abs(result.value.balance))}</dd>
            </div>
          </dl>
          <details>
            <summary>รายละเอียดการคำนวณ</summary>
            <div className="table-scroll" style={{ marginTop: "var(--space-2)" }}>
              <table className="money-table">
                <tbody>
                  <tr>
                    <td>หักค่าใช้จ่าย 50% (≤100,000)</td>
                    <td>{formatBaht(result.value.expenseDeduction)}</td>
                  </tr>
                  {result.value.allowances.map((a) => (
                    <tr key={a.label}>
                      <td>ลดหย่อน{a.label}</td>
                      <td>{formatBaht(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="money-table" style={{ marginTop: "var(--space-3)" }}>
                <thead>
                  <tr>
                    <th>ช่วงเงินได้สุทธิ</th>
                    <th>อัตรา</th>
                    <th>ภาษี</th>
                  </tr>
                </thead>
                <tbody>
                  {result.value.brackets.map((b) => (
                    <tr key={b.from}>
                      <td>
                        {formatBaht(b.from)}–{Number.isFinite(b.to) ? formatBaht(b.to) : "ขึ้นไป"}
                      </td>
                      <td>{b.rate * 100}%</td>
                      <td>{formatBaht(b.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
      <p className="muted small">ประมาณการสำหรับเงินเดือน (เงินได้ประเภทที่ 1) ตามอัตราภาษีปัจจุบันและค่าลดหย่อนหลักของปีภาษี 2568 เงื่อนไขจริงอาจต่างกัน ตรวจสอบกับกรมสรรพากรก่อนยื่นภาษี</p>
    </div>
  );
}
