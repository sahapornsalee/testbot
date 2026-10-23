import { useState } from "react";
import { Copy, Download, FileUp, Scissors, ShieldCheck } from "lucide-react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { sendTo } from "../../lib/handoff";
import { formatBytes } from "../image-to-text/analyze";
import { downloadText } from "../settings/backup";
import { officeToText, type OfficeKind } from "./office";
import "./ai-tools.css";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_OCR_PAGES = 20;
const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md,.json,.html,.htm,.xml";

type Kind = OfficeKind | "pdf" | "text" | "html";

function kindOf(name: string): Kind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "xlsx" || ext === "pptx") return ext;
  if (["txt", "csv", "md", "json", "xml"].includes(ext)) return "text";
  if (ext === "html" || ext === "htm") return "html";
  return null;
}

export default function FileToTextWidget() {
  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyState, copy] = useCopy();

  const read = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    setText("");
    setScanned(false);
    const kind = kindOf(picked.name);
    if (!kind) {
      setError("ไฟล์ชนิดนี้ยังไม่รองรับ รองรับ PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), TXT, CSV, Markdown, JSON, HTML");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError(`ไฟล์ใหญ่เกิน ${formatBytes(MAX_BYTES)}`);
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await picked.arrayBuffer());
      setFile({ name: picked.name, size: picked.size, bytes });
      if (kind === "pdf") {
        const { extractPdfText, pagesToText } = await import("../files/pdf");
        const result = await extractPdfText(bytes, (done, total) => setStatus(`กำลังอ่านหน้า ${done}/${total}`));
        setText(pagesToText(result.pages));
        setScanned(!result.hasText);
      } else if (kind === "text") {
        setText(new TextDecoder().decode(bytes));
      } else if (kind === "html") {
        const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "text/html");
        doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
        setText((doc.body?.innerText ?? doc.body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim());
      } else {
        setText(officeToText(kind, bytes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const ocrPdf = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { openPdf, renderPage, pagesToText } = await import("../files/pdf");
      const { recognizeText } = await import("../image-to-text/ocr");
      const doc = await openPdf(file.bytes);
      const total = Math.min(doc.numPages, MAX_OCR_PAGES);
      const pages: string[] = [];
      for (let n = 1; n <= total; n++) {
        setStatus(`กำลังอ่านด้วย OCR หน้า ${n}/${total}`);
        const canvas = await renderPage(doc, n, 2);
        pages.push((await recognizeText(canvas)).text);
      }
      await doc.loadingTask.destroy();
      setText(pagesToText(pages) + (doc.numPages > total ? `\n\n(อ่าน ${total} หน้าแรกจาก ${doc.numPages} หน้า)` : ""));
      setScanned(false);
    } catch {
      setError(navigator.onLine ? "อ่านด้วย OCR ไม่สำเร็จ" : "OCR ต้องดาวน์โหลดตอนออนไลน์ครั้งแรก 1 ครั้ง");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div className="stack">
      <div className="drop-zone">
        <FileUp aria-hidden="true" size={36} />
        <p className="muted small" style={{ margin: 0 }}>
          PDF · Word · Excel · PowerPoint · TXT · CSV · HTML — อ่านในเครื่อง ไม่อัปโหลด
        </p>
        <label className="btn btn-primary">
          {busy ? "กำลังอ่าน…" : "เลือกไฟล์"}
          <input
            type="file"
            accept={ACCEPT}
            className="visually-hidden"
            aria-label="เลือกไฟล์เอกสาร"
            disabled={busy}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {file && (
          <span className="small">
            {file.name} ({formatBytes(file.size)})
          </span>
        )}
      </div>
      {status && (
        <p className="small muted" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {scanned && (
        <div className="notice" role="status">
          ไม่พบตัวหนังสือในไฟล์ PDF นี้ (น่าจะเป็นภาพสแกน){" "}
          <button type="button" className="btn small" disabled={busy} onClick={() => void ocrPdf()}>
            อ่านด้วย OCR (ไม่เกิน {MAX_OCR_PAGES} หน้า)
          </button>
        </div>
      )}
      {text && (
        <>
          <textarea className="input prompt-output" rows={14} aria-label="ข้อความจากไฟล์" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => copy(text)}>
              <Copy aria-hidden="true" size={16} /> {COPY_LABEL[copyState]}
            </button>
            <button type="button" className="btn" onClick={() => sendTo("text-splitter", text)}>
              <Scissors aria-hidden="true" size={16} /> แบ่งเป็นส่วน ๆ
            </button>
            <button type="button" className="btn" onClick={() => sendTo("redact", text)}>
              <ShieldCheck aria-hidden="true" size={16} /> ปิดข้อมูลส่วนตัว
            </button>
            <button type="button" className="btn" onClick={() => downloadText(text, `${file?.name.replace(/\.[^.]+$/, "") ?? "ข้อความ"}.txt`, "text/plain")}>
              <Download aria-hidden="true" size={16} /> .txt
            </button>
            <span className="small muted">{text.length.toLocaleString("th-TH")} ตัวอักษร</span>
          </div>
        </>
      )}
    </div>
  );
}
