import { useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { bahtText } from "./bahtText";
import { parseNumber } from "../converter/units";

export default function BahtTextWidget() {
  const [input, setInput] = useState("1250.50");
  const [copyState, copy] = useCopy();
  const value = parseNumber(input);
  const result = input.trim() === "" ? null : bahtText(value);

  return (
    <div className="stack">
      <label className="field">
        จำนวนเงิน (บาท)
        <input className="input" inputMode="decimal" value={input} aria-invalid={result !== null && !result.ok} onChange={(e) => setInput(e.target.value)} />
      </label>
      <div className="result-box" role="status">
        {result === null ? (
          <span className="muted">ใส่จำนวนเงินเพื่ออ่านเป็นตัวอักษร</span>
        ) : result.ok ? (
          <span className="result-value baht-text">{result.text}</span>
        ) : (
          <span className="error-text">{result.error}</span>
        )}
      </div>
      {result?.ok && (
        <div className="button-row">
          <button type="button" className="btn small" onClick={() => copy(result.text)}>
            {COPY_LABEL[copyState]}
          </button>
          <button type="button" className="btn small" onClick={() => copy(`(${result.text})`)}>
            คัดลอกพร้อมวงเล็บ
          </button>
        </div>
      )}
      <p className="muted small">ใช้เขียนเช็ค ใบเสร็จ หรือเอกสารการเงิน (ปัดเศษสตางค์ 2 ตำแหน่ง)</p>
    </div>
  );
}
