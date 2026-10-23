import { useState } from "react";
import { parseNumber } from "../converter/units";
import { formatBaht } from "./expenses";
import { amortizationSchedule, amortizedLoan, flatRateLoan } from "./loan";
import "./money.css";

type Mode = "reducing" | "flat";

export default function LoanWidget() {
  const [mode, setMode] = useState<Mode>("reducing");
  const [principal, setPrincipal] = useState("1,000,000");
  const [rate, setRate] = useState("6");
  const [years, setYears] = useState("30");
  const [showSchedule, setShowSchedule] = useState(false);

  const input = { principal: parseNumber(principal), annualRate: parseNumber(rate), months: Math.round(parseNumber(years) * 12) };
  const reducing = amortizedLoan(input);
  const flat = flatRateLoan(input);
  const result = mode === "reducing" ? reducing : flat;
  const schedule = showSchedule && mode === "reducing" ? amortizationSchedule(input) : null;

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="ประเภทดอกเบี้ย">
        <button type="button" aria-pressed={mode === "reducing"} onClick={() => setMode("reducing")}>
          ลดต้นลดดอก (บ้าน)
        </button>
        <button type="button" aria-pressed={mode === "flat"} onClick={() => setMode("flat")}>
          คงที่ (รถ/ผ่อนสินค้า)
        </button>
      </div>
      <div className="field-row">
        <label className="field">
          ยอดเงินกู้ (บาท)
          <input className="input" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
        </label>
        <label className="field">
          ดอกเบี้ยต่อปี (%)
          <input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="field">
          ระยะเวลา (ปี)
          <input className="input" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
      </div>
      {result.ok ? (
        <>
          <dl className="stat-grid" aria-live="polite">
            <div>
              <dt>ผ่อนต่อเดือน</dt>
              <dd>{formatBaht(result.value.monthlyPayment)}</dd>
            </div>
            <div>
              <dt>ดอกเบี้ยรวม</dt>
              <dd>{formatBaht(result.value.totalInterest)}</dd>
            </div>
            <div>
              <dt>จ่ายทั้งหมด</dt>
              <dd>{formatBaht(result.value.totalPaid)}</dd>
            </div>
            <div>
              <dt>จำนวนงวด</dt>
              <dd>{input.months} เดือน</dd>
            </div>
          </dl>
          {mode === "flat" && flat.ok && (
            <p className="muted small">ดอกเบี้ยคงที่ {rate}% เทียบได้กับดอกเบี้ยแบบลดต้นลดดอกประมาณ {flat.value.effectiveRate}% ต่อปี</p>
          )}
          {mode === "reducing" && (
            <button type="button" className="btn small" aria-expanded={showSchedule} onClick={() => setShowSchedule((s) => !s)}>
              {showSchedule ? "ซ่อนตารางผ่อน" : "ดูตารางผ่อนรายเดือน"}
            </button>
          )}
          {schedule?.ok && (
            <div className="table-scroll" tabIndex={0} aria-label="ตารางผ่อนรายเดือน">
              <table className="money-table">
                <thead>
                  <tr>
                    <th>งวด</th>
                    <th>ค่างวด</th>
                    <th>ดอกเบี้ย</th>
                    <th>เงินต้น</th>
                    <th>คงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.value.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{formatBaht(row.payment)}</td>
                      <td>{formatBaht(row.interest)}</td>
                      <td>{formatBaht(row.principal)}</td>
                      <td>{formatBaht(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
      <p className="muted small">ผลลัพธ์เป็นการประมาณ ยอดจริงขึ้นกับเงื่อนไขของสถาบันการเงิน</p>
    </div>
  );
}
