import { useState } from "react";
import { BASES, convertBase } from "./convert";
import "./devtools.css";

export default function BaseWidget() {
  const [from, setFrom] = useState(10);
  const [input, setInput] = useState("255");
  const result = convertBase(input, from);

  return (
    <div className="stack">
      <div className="field-row">
        <label className="field">
          ตัวเลข
          <input className="input mono" value={input} aria-invalid={!result.ok && input.trim() !== ""} onChange={(e) => setInput(e.target.value)} />
        </label>
        <label className="field">
          เป็นเลข
          <select className="input" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {BASES.map((b) => (
              <option key={b.base} value={b.base}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {result.ok ? (
        <dl className="stack" style={{ margin: 0 }}>
          {BASES.map((b) => (
            <div key={b.base} className="hash-row">
              <dt className="small muted">{b.label}</dt>
              <dd style={{ margin: 0 }}>
                <code>{result.values[b.base]}</code>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
