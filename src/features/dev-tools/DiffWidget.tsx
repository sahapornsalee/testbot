import { useState } from "react";
import { diffLines } from "./diff";
import "./devtools.css";

export default function DiffWidget() {
  const [left, setLeft] = useState("สวัสดี\nวันนี้อากาศดี\nไปเที่ยวกัน");
  const [right, setRight] = useState("สวัสดีครับ\nวันนี้อากาศดี\nไปเที่ยวทะเลกัน\nกลับบ้าน");
  const result = diffLines(left, right);
  const added = result.ok ? result.lines.filter((l) => l.type === "added").length : 0;
  const removed = result.ok ? result.lines.filter((l) => l.type === "removed").length : 0;

  return (
    <div className="stack">
      <div className="markdown-panes view-split">
        <label className="field">
          ต้นฉบับ
          <textarea className="input devtool-input" value={left} onChange={(e) => setLeft(e.target.value)} />
        </label>
        <label className="field">
          ฉบับแก้ไข
          <textarea className="input devtool-input" value={right} onChange={(e) => setRight(e.target.value)} />
        </label>
      </div>
      {result.ok ? (
        <>
          <p className="small" role="status" style={{ margin: 0 }}>
            <span className="success-text">+{added} เพิ่ม</span> · <span className="error-text">−{removed} ลบ</span>
            {added === 0 && removed === 0 ? " · เหมือนกันทุกบรรทัด" : ""}
          </p>
          <div className="diff-view" tabIndex={0} aria-label="ผลการเปรียบเทียบ">
            {result.lines.map((line, i) => (
              <div key={i} className={`diff-line ${line.type}`}>
                <span>{line.oldLine ?? ""}</span>
                <span>{line.newLine ?? ""}</span>
                <span aria-label={line.type === "added" ? "เพิ่ม" : line.type === "removed" ? "ลบ" : undefined}>
                  {line.type === "added" ? "+" : line.type === "removed" ? "−" : ""}
                </span>
                <span>{line.text || " "}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="error-text" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
