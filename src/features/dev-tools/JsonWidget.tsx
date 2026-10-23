import { useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { transformJson, type JsonResult } from "./json";
import "./devtools.css";

export default function JsonWidget() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [result, setResult] = useState<JsonResult | null>(null);
  const [copyState, copy] = useCopy();

  const run = (mode: "format" | "minify") =>
    setResult(transformJson(input, mode, { indent: indent === "tab" ? "\t" : Number(indent), sortKeys }));

  return (
    <div className="stack">
      <label className="field">
        JSON ต้นฉบับ
        <textarea
          className="input devtool-input"
          rows={8}
          spellCheck={false}
          placeholder='{"name": "Productivity Hub"}'
          value={input}
          aria-invalid={result !== null && !result.ok}
          onChange={(e) => {
            setInput(e.target.value);
            setResult(null);
          }}
        />
      </label>
      <div className="button-row">
        <button type="button" className="btn btn-primary" onClick={() => run("format")}>
          จัดรูปแบบ
        </button>
        <button type="button" className="btn" onClick={() => run("minify")}>
          ย่อ (Minify)
        </button>
        <label className="field inline-field">
          เยื้อง
          <select className="input" value={indent} onChange={(e) => setIndent(e.target.value as typeof indent)}>
            <option value="2">2 ช่อง</option>
            <option value="4">4 ช่อง</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
          เรียง key
        </label>
      </div>
      {result &&
        (result.ok ? (
          <div className="stack">
            <p className="success-text small" role="status">
              JSON ถูกต้อง
            </p>
            <pre className="devtool-output" tabIndex={0} aria-label="ผลลัพธ์ JSON">
              {result.output}
            </pre>
            <div className="button-row">
              <button type="button" className="btn small" onClick={() => copy(result.output)}>
                {COPY_LABEL[copyState]}
              </button>
              <button type="button" className="btn small" onClick={() => setInput(result.output)}>
                ใช้ผลลัพธ์เป็นต้นฉบับ
              </button>
            </div>
          </div>
        ) : (
          <p className="error-text" role="alert">
            {result.error}
          </p>
        ))}
    </div>
  );
}
