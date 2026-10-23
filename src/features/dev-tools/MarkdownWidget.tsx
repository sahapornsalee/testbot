import { useState } from "react";
import { MarkdownView } from "./markdown";
import "./devtools.css";

const SAMPLE = `# หัวข้อ

พิมพ์ **ตัวหนา**, *ตัวเอียง* และ \`code\` ได้

- รายการ
- [x] งานที่เสร็จแล้ว

> ข้อความอ้างอิง

[ลิงก์ตัวอย่าง](https://example.com)`;

export default function MarkdownWidget() {
  const [source, setSource] = useState(SAMPLE);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="มุมมอง">
        {(
          [
            ["split", "แบ่งครึ่ง"],
            ["edit", "แก้ไข"],
            ["preview", "ตัวอย่าง"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className={`markdown-panes view-${view}`}>
        {view !== "preview" && (
          <textarea
            className="input devtool-input"
            aria-label="Markdown"
            rows={14}
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        )}
        {view !== "edit" && (
          <section className="markdown-preview" aria-label="ตัวอย่างผลลัพธ์">
            <MarkdownView source={source} />
          </section>
        )}
      </div>
      <p className="muted small">แสดงผลอย่างปลอดภัย: ไม่รัน HTML หรือสคริปต์ และเปิดได้เฉพาะลิงก์ http/https/mailto</p>
    </div>
  );
}
