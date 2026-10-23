import { useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { contrastRatio, parseColor, toHex, toHsl } from "./convert";
import "./devtools.css";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

export default function ColorWidget() {
  const [input, setInput] = useState("#2563EB");
  const [copyState, copy] = useCopy();
  const [copied, setCopied] = useState("");
  const rgb = parseColor(input);

  const formats = rgb
    ? [
        { label: "HEX", value: toHex(rgb) },
        { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
        { label: "HSL", value: (({ h, s, l }) => `hsl(${h}, ${s}%, ${l}%)`)(toHsl(rgb)) },
      ]
    : [];

  return (
    <div className="stack">
      <div className="field-row">
        <label className="field">
          สี (HEX, RGB หรือ HSL)
          <input className="input mono" value={input} aria-invalid={!rgb} onChange={(e) => setInput(e.target.value)} />
        </label>
        <label className="field">
          เลือกสี
          <input className="input" type="color" value={rgb ? toHex(rgb).toLowerCase() : "#000000"} onChange={(e) => setInput(e.target.value.toUpperCase())} />
        </label>
      </div>
      {rgb ? (
        <>
          <div className="color-swatch" style={{ background: toHex(rgb) }} aria-hidden="true" />
          {formats.map((f) => (
            <div key={f.label} className="button-row">
              <strong className="small" style={{ width: 40 }}>
                {f.label}
              </strong>
              <code className="mono">{f.value}</code>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  copy(f.value);
                  setCopied(f.label);
                }}
              >
                {copied === f.label ? COPY_LABEL[copyState] : "คัดลอก"}
              </button>
            </div>
          ))}
          <div className="field-row">
            {[
              { bg: rgb, fg: WHITE, label: "ตัวอักษรขาว" },
              { bg: rgb, fg: BLACK, label: "ตัวอักษรดำ" },
            ].map(({ bg, fg, label }) => {
              const ratio = contrastRatio(bg, fg);
              return (
                <div key={label} className="contrast-sample" style={{ background: toHex(bg), color: toHex(fg) }}>
                  {label} {ratio}:1 {ratio >= 4.5 ? "✓ AA" : ratio >= 3 ? "ตัวใหญ่เท่านั้น" : "✗"}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="error-text" role="alert">
          รูปแบบสีไม่ถูกต้อง เช่น #2563EB, rgb(37, 99, 235), hsl(221, 83%, 53%)
        </p>
      )}
    </div>
  );
}
