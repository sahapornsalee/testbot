import { useState } from "react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { applyTransform, textStats, TRANSFORMS, type TextTransform } from "./text";
import "./devtools.css";

export default function TextWidget() {
  const [text, setText] = useState("");
  const [transform, setTransform] = useState<TextTransform>("upper");
  const [error, setError] = useState<string | null>(null);
  const [copyState, copy] = useCopy();
  const stats = textStats(text);

  return (
    <div className="stack">
      <textarea
        className="input devtool-input"
        aria-label="ข้อความ"
        rows={8}
        placeholder="วางหรือพิมพ์ข้อความ…"
        value={text}
        aria-invalid={error !== null}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      <dl className="text-stats">
        <div>
          <dt>ตัวอักษร</dt>
          <dd>{stats.characters.toLocaleString("th-TH")}</dd>
        </div>
        <div>
          <dt>ไม่นับช่องว่าง</dt>
          <dd>{stats.charactersNoSpaces.toLocaleString("th-TH")}</dd>
        </div>
        <div>
          <dt>คำ</dt>
          <dd>{stats.words.toLocaleString("th-TH")}</dd>
        </div>
        <div>
          <dt>บรรทัด</dt>
          <dd>{stats.lines.toLocaleString("th-TH")}</dd>
        </div>
      </dl>
      <div className="button-row">
        <label className="field inline-field">
          แปลงข้อความ
          <select className="input" value={transform} onChange={(e) => setTransform(e.target.value as TextTransform)}>
            {TRANSFORMS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={text === ""}
          onClick={() => {
            const result = applyTransform(text, transform);
            if (result.ok) {
              setText(result.output);
              setError(null);
            } else {
              setError(result.error);
            }
          }}
        >
          แปลง
        </button>
        <button type="button" className="btn" disabled={text === ""} onClick={() => copy(text)}>
          {COPY_LABEL[copyState]}
        </button>
        <button type="button" className="btn" disabled={text === ""} onClick={() => setText("")}>
          ล้าง
        </button>
      </div>
      {error && (
        <p className="error-text small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
