import { useState } from "react";
import { adjustByPercent, percentChange, percentOf, whatPercent } from "./percentage";
import { formatNumber, parseNumber, type ConversionResult } from "./units";

type Mode = "of" | "what" | "change" | "adjust";

const MODES: { id: Mode; label: string; a: string; b: string; suffix: string }[] = [
  { id: "of", label: "x% ของ y", a: "เปอร์เซ็นต์ (%)", b: "ของจำนวน", suffix: "" },
  { id: "what", label: "x เป็นกี่ % ของ y", a: "จำนวน", b: "จากทั้งหมด", suffix: "%" },
  { id: "change", label: "เปลี่ยนแปลงกี่ %", a: "ค่าเดิม", b: "ค่าใหม่", suffix: "%" },
  { id: "adjust", label: "เพิ่ม/ลด %", a: "จำนวน", b: "เพิ่ม (+) หรือลด (−) %", suffix: "" },
];

function compute(mode: Mode, a: number, b: number): ConversionResult {
  switch (mode) {
    case "of":
      return percentOf(a, b);
    case "what":
      return whatPercent(a, b);
    case "change":
      return percentChange(a, b);
    case "adjust":
      return adjustByPercent(a, b);
  }
}

export default function PercentageWidget() {
  const [mode, setMode] = useState<Mode>("of");
  const [a, setA] = useState("7");
  const [b, setB] = useState("1500");
  const config = MODES.find((m) => m.id === mode)!;
  const empty = a.trim() === "" || b.trim() === "";
  const result = empty ? null : compute(mode, parseNumber(a), parseNumber(b));

  return (
    <div className="stack">
      <label className="field">
        คำนวณแบบ
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          {config.a}
          <input className="input" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label className="field">
          {config.b}
          <input className="input" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} />
        </label>
      </div>
      <div className="result-box" role="status">
        {result === null ? (
          <span className="muted">กรอกตัวเลขให้ครบ</span>
        ) : result.ok ? (
          <span className="result-value">
            {mode === "change" && result.value > 0 ? "+" : ""}
            {formatNumber(result.value)}
            {config.suffix}
          </span>
        ) : (
          <span className="error-text">{result.error}</span>
        )}
      </div>
    </div>
  );
}
