import { useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { generateUuids, isUuid } from "./uuid";
import "./devtools.css";

export default function UuidWidget() {
  const [count, setCount] = useState("5");
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [ids, setIds] = useState<string[]>(() => generateUuids(5));
  const [check, setCheck] = useState("");
  const [copyState, copy] = useCopy();

  const n = Number(count);
  const countValid = Number.isInteger(n) && n >= 1 && n <= 1000;

  return (
    <div className="stack">
      <div className="button-row">
        <label className="field inline-field">
          จำนวน
          <input
            className="input count-input"
            type="number"
            min={1}
            max={1000}
            value={count}
            aria-invalid={!countValid}
            onChange={(e) => setCount(e.target.value)}
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
          ตัวพิมพ์ใหญ่
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} />
          มีขีด (-)
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!countValid}
          onClick={() => setIds(generateUuids(n, { uppercase, hyphens }))}
        >
          สร้าง UUID
        </button>
      </div>
      {!countValid && <p className="error-text small">จำนวนต้องเป็น 1–1000</p>}
      <pre className="devtool-output" tabIndex={0} aria-label="UUID ที่สร้าง">
        {ids.join("\n")}
      </pre>
      <div className="button-row">
        <button type="button" className="btn small" onClick={() => copy(ids.join("\n"))}>
          {COPY_LABEL[copyState]}ทั้งหมด
        </button>
      </div>
      <label className="field">
        ตรวจสอบ UUID
        <input className="input mono" value={check} placeholder="วาง UUID เพื่อตรวจ" onChange={(e) => setCheck(e.target.value)} />
      </label>
      {check.trim() && (
        <p className={isUuid(check) ? "success-text small" : "error-text small"} role="status">
          {isUuid(check) ? "รูปแบบ UUID ถูกต้อง" : "ไม่ใช่รูปแบบ UUID"}
        </p>
      )}
    </div>
  );
}
