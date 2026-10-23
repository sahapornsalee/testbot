import { useId, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CATEGORIES, convert, formatNumber, parseNumber } from "./units";

export default function ConverterWidget() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? "length");
  const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0]!;
  const [from, setFrom] = useState(category.units[2]?.id ?? category.units[0]!.id);
  const [to, setTo] = useState(category.units[1]?.id ?? category.units[0]!.id);
  const [input, setInput] = useState("1");
  const id = useId();

  const changeCategory = (next: string) => {
    const c = CATEGORIES.find((x) => x.id === next);
    if (!c) return;
    setCategoryId(next);
    setFrom(c.units[0]!.id);
    setTo((c.units[1] ?? c.units[0])!.id);
  };

  const value = parseNumber(input);
  const result = input.trim() === "" ? null : convert(value, category.id, from, to);
  const unitLabel = (unitId: string) => category.units.find((u) => u.id === unitId)?.label ?? unitId;

  return (
    <div className="stack">
      <label className="field">
        ประเภท
        <select className="input" value={category.id} onChange={(e) => changeCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        ค่า
        <input
          className="input"
          inputMode="decimal"
          value={input}
          aria-invalid={result !== null && !result.ok}
          aria-describedby={`${id}-result`}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      <div className="field-row converter-units">
        <label className="field">
          จาก
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {category.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-btn"
          aria-label="สลับหน่วย"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <ArrowLeftRight aria-hidden="true" size={18} />
        </button>
        <label className="field">
          เป็น
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {category.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id={`${id}-result`} className="result-box" role="status">
        {result === null ? (
          <span className="muted">ใส่ค่าที่ต้องการแปลง</span>
        ) : result.ok ? (
          <>
            <span className="muted small">
              {formatNumber(value)} {unitLabel(from)} =
            </span>
            <br />
            <span className="result-value">{formatNumber(result.value)}</span> <span>{unitLabel(to)}</span>
          </>
        ) : (
          <span className="error-text">{result.error}</span>
        )}
      </div>
    </div>
  );
}
