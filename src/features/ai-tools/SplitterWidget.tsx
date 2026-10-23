import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { takeHandoff } from "../../lib/handoff";
import { splitForChat } from "./splitter";
import "./ai-tools.css";

const LIMITS = [2000, 4000, 8000, 16000, 32000];

export default function SplitterWidget() {
  const [text, setText] = useState(() => takeHandoff("text-splitter") ?? "");
  const [limit, setLimit] = useState(4000);
  const [withInstructions, setWithInstructions] = useState(true);
  const [task, setTask] = useState("สรุปเนื้อหาทั้งหมดเป็นข้อ ๆ");
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const parts = splitForChat(text, { maxChars: limit, withInstructions, task });

  const copyPart = (index: number) => {
    navigator.clipboard?.writeText(parts[index] ?? "").then(
      () => setCopied((s) => new Set(s).add(index)),
      () => setError("คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วคัดลอกเอง"),
    );
  };

  return (
    <div className="stack">
      <label className="field">
        ข้อความยาว
        <textarea
          className="input"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCopied(new Set());
          }}
        />
      </label>
      <div className="field-row">
        <label className="field">
          ความยาวสูงสุดต่อข้อความ
          <select className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {LIMITS.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("th-TH")} ตัวอักษร
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          ให้ AI ทำอะไรเมื่อได้ครบ
          <input className="input" value={task} disabled={!withInstructions} onChange={(e) => setTask(e.target.value)} />
        </label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={withInstructions} onChange={(e) => setWithInstructions(e.target.checked)} />
        ใส่คำสั่งให้ AI รอจนได้ครบทุกส่วนก่อนตอบ
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {parts.length > 0 && (
        <>
          <p className="small" role="status" style={{ margin: 0 }}>
            แบ่งได้ {parts.length} ส่วน · คัดลอกแล้ว {copied.size}/{parts.length} — วางในแชททีละส่วนตามลำดับ
          </p>
          <ol className="part-list" aria-label="ส่วนที่แบ่งแล้ว">
            {parts.map((part, i) => (
              <li key={i} className={`part-item ${copied.has(i) ? "is-copied" : ""}`}>
                <div className="button-row">
                  <strong>
                    ส่วนที่ {i + 1}/{parts.length}
                  </strong>
                  <span className="small muted">{part.length.toLocaleString("th-TH")} ตัวอักษร</span>
                  <button type="button" className={`btn small ${copied.has(i) ? "" : "btn-primary"}`} onClick={() => copyPart(i)}>
                    {copied.has(i) ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
                    {copied.has(i) ? "คัดลอกแล้ว" : `คัดลอกส่วนที่ ${i + 1}`}
                  </button>
                </div>
                <pre>{part}</pre>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
