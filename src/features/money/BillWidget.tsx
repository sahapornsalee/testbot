import { useState } from "react";
import { parseNumber } from "../converter/units";
import { splitBill } from "./bill";
import { formatBaht } from "./expenses";
import "./money.css";

export default function BillWidget() {
  const [subtotal, setSubtotal] = useState("1500");
  const [people, setPeople] = useState("4");
  const [service, setService] = useState("10");
  const [vat, setVat] = useState("7");
  const [discount, setDiscount] = useState("0");
  const [tip, setTip] = useState("0");
  const [roundUp, setRoundUp] = useState(true);

  const num = (s: string) => (s.trim() === "" ? 0 : parseNumber(s));
  const result = splitBill({
    subtotal: num(subtotal),
    discount: num(discount),
    servicePercent: num(service),
    vatPercent: num(vat),
    tip: num(tip),
    people: Number(people),
    roundUp,
  });

  return (
    <div className="stack">
      <div className="field-row">
        <label className="field">
          ยอดอาหาร (บาท)
          <input className="input" inputMode="decimal" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        </label>
        <label className="field">
          จำนวนคน
          <input className="input" type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          Service charge (%)
          <input className="input" inputMode="decimal" value={service} onChange={(e) => setService(e.target.value)} />
        </label>
        <label className="field">
          VAT (%)
          <input className="input" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} />
        </label>
        <label className="field">
          ส่วนลด (บาท)
          <input className="input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="field">
          ทิป (บาท)
          <input className="input" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
        </label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={roundUp} onChange={(e) => setRoundUp(e.target.checked)} />
        ปัดขึ้นเป็นบาทเต็ม
      </label>
      {result.ok ? (
        <>
          <div className="result-box" role="status">
            <span className="muted small">คนละ</span>
            <br />
            <span className="result-value">{formatBaht(result.value.perPerson)} บาท</span>
          </div>
          <dl className="stat-grid">
            <div>
              <dt>หลังส่วนลด</dt>
              <dd>{formatBaht(result.value.afterDiscount)}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{formatBaht(result.value.service)}</dd>
            </div>
            <div>
              <dt>VAT</dt>
              <dd>{formatBaht(result.value.vat)}</dd>
            </div>
            <div>
              <dt>รวมทั้งหมด</dt>
              <dd>{formatBaht(result.value.total)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
