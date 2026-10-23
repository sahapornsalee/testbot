import { useState } from "react";
import { formatThaiId, isValidThaiId, THAI_ID_TYPES, thaiIdCheckDigit } from "../../lib/thaiId";

export default function ThaiIdWidget() {
  const [value, setValue] = useState("");
  const digits = value.replace(/\D/g, "");
  const valid = digits.length === 13 && isValidThaiId(digits);

  return (
    <div className="stack">
      <label className="field">
        เลขประจำตัวประชาชน 13 หลัก
        <input className="input mono" inputMode="numeric" maxLength={17} value={value} aria-invalid={digits.length === 13 && !valid} onChange={(e) => setValue(formatThaiId(e.target.value))} />
      </label>
      <div className="result-box" role="status">
        {digits.length < 12 ? (
          <span className="muted">พิมพ์เลขให้ครบ 13 หลัก ({digits.length}/13)</span>
        ) : digits.length === 12 ? (
          <span>
            หลักสุดท้ายที่ถูกต้องคือ <strong>{thaiIdCheckDigit(digits)}</strong> → {formatThaiId(digits + thaiIdCheckDigit(digits))}
          </span>
        ) : valid ? (
          <span className="success-text">✓ รูปแบบเลขถูกต้อง</span>
        ) : (
          <span className="error-text">✗ เลขไม่ถูกต้อง (หลักสุดท้ายควรเป็น {thaiIdCheckDigit(digits.slice(0, 12))})</span>
        )}
      </div>
      {digits.length >= 1 && THAI_ID_TYPES[digits[0] as string] && (
        <p className="small muted">หลักแรก {digits[0]}: {THAI_ID_TYPES[digits[0] as string]}</p>
      )}
      <p className="muted small">ตรวจเฉพาะสูตรของเลข ไม่ได้ยืนยันว่ามีบุคคลนี้จริง ข้อมูลไม่ถูกส่งไปที่ใด</p>
    </div>
  );
}
