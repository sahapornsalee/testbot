import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { generatePassword, passwordEntropy, strengthLabel, type PasswordOptions } from "./password";
import "./devtools.css";

const TOGGLES: { key: keyof Omit<PasswordOptions, "length">; label: string }[] = [
  { key: "lower", label: "a–z" },
  { key: "upper", label: "A–Z" },
  { key: "digits", label: "0–9" },
  { key: "symbols", label: "สัญลักษณ์ !@#" },
  { key: "excludeAmbiguous", label: "ไม่ใช้ตัวที่คล้ายกัน (0 O 1 l)" },
];

export default function PasswordWidget() {
  const [options, setOptions] = useState<PasswordOptions>({ length: 16, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: true });
  const [result, setResult] = useState(() => generatePassword(options));
  const [copyState, copy] = useCopy();
  const strength = strengthLabel(passwordEntropy(options));

  const update = (patch: Partial<PasswordOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setResult(generatePassword(next));
  };

  return (
    <div className="stack">
      <div className="result-box" role="status">
        {result.ok ? <span className="password-output">{result.value}</span> : <span className="error-text">{result.error}</span>}
      </div>
      <div className="strength-meter" data-level={strength.level} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        ความแข็งแรง: <strong>{strength.label}</strong> ({passwordEntropy(options)} bits)
      </p>
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => setResult(generatePassword(options))}>
          <RefreshCw aria-hidden="true" size={16} /> สร้างใหม่
        </button>
        <button type="button" className="btn" disabled={!result.ok} onClick={() => result.ok && copy(result.value)}>
          {COPY_LABEL[copyState]}
        </button>
      </div>
      <label className="field">
        ความยาว: {options.length} ตัว
        <input type="range" min={4} max={64} value={options.length} onChange={(e) => update({ length: Number(e.target.value) })} />
      </label>
      <div className="button-row">
        {TOGGLES.map((t) => (
          <label key={t.key} className="checkbox-label">
            <input type="checkbox" checked={options[t.key]} onChange={(e) => update({ [t.key]: e.target.checked })} />
            {t.label}
          </label>
        ))}
      </div>
      <p className="muted small">สร้างด้วยตัวสุ่มที่ปลอดภัยของเบราว์เซอร์ ในเครื่องนี้เท่านั้น ไม่ถูกบันทึกหรือส่งไปที่ใด</p>
    </div>
  );
}
