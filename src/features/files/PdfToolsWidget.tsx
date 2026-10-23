import { useState } from "react";
import { ArrowDown, ArrowUp, Download, X } from "lucide-react";
import { zipSync } from "fflate";
import { formatBytes } from "../image-to-text/analyze";
import { canvasToBlob, downloadBlob, loadImageFile } from "./download";
import { extractPages, imagesToPdf, mergePdfs, pageCount, parsePageRanges, splitAll } from "./pdfOps";
import "./files.css";

type Mode = "merge" | "split" | "images";
interface Item {
  key: number;
  file: File;
}

let nextKey = 1;
const MAX_TOTAL = 200 * 1024 * 1024;

export default function PdfToolsWidget() {
  const [mode, setMode] = useState<Mode>("merge");
  const [items, setItems] = useState<Item[]>([]);
  const [ranges, setRanges] = useState("1");
  const [pages, setPages] = useState<number | null>(null);
  const [layout, setLayout] = useState<"a4" | "fit">("a4");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const accept = mode === "images" ? "image/*" : "application/pdf,.pdf";
  const multiple = mode !== "split";

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setMessage(null);
    const picked = [...files].filter((f) => (mode === "images" ? f.type.startsWith("image/") : f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")));
    if (picked.length === 0) {
      setMessage({ kind: "error", text: mode === "images" ? "กรุณาเลือกไฟล์รูปภาพ" : "กรุณาเลือกไฟล์ PDF" });
      return;
    }
    const next = multiple ? [...items, ...picked.map((file) => ({ key: nextKey++, file }))] : [{ key: nextKey++, file: picked[0] as File }];
    if (next.reduce((s, i) => s + i.file.size, 0) > MAX_TOTAL) {
      setMessage({ kind: "error", text: `ไฟล์รวมใหญ่เกิน ${formatBytes(MAX_TOTAL)}` });
      return;
    }
    setItems(next);
    if (mode === "split") {
      try {
        const n = await pageCount(new Uint8Array(await (picked[0] as File).arrayBuffer()));
        setPages(n);
        setRanges(`1-${n}`);
      } catch (e) {
        setPages(null);
        setMessage({ kind: "error", text: e instanceof Error ? e.message : "เปิดไฟล์ไม่ได้" });
      }
    }
  };

  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item as Item);
      return next;
    });

  const run = async (action: "merge" | "extract" | "split-all" | "images") => {
    setBusy(true);
    setMessage(null);
    try {
      const bytes = await Promise.all(items.map(async (i) => new Uint8Array(await i.file.arrayBuffer())));
      if (action === "merge") {
        downloadBlob(await mergePdfs(bytes), "รวมไฟล์.pdf", "application/pdf");
      } else if (action === "extract") {
        const parsed = parsePageRanges(ranges, pages ?? 0);
        if (!parsed.ok) throw new Error(parsed.error);
        downloadBlob(await extractPages(bytes[0] as Uint8Array, parsed.pages), `${items[0]?.file.name.replace(/\.pdf$/i, "")}-หน้า-${ranges.replace(/\s+/g, "")}.pdf`, "application/pdf");
      } else if (action === "split-all") {
        const parts = await splitAll(bytes[0] as Uint8Array);
        const base = items[0]?.file.name.replace(/\.pdf$/i, "") ?? "file";
        downloadBlob(zipSync(Object.fromEntries(parts.map((p, i) => [`${base}-หน้า${i + 1}.pdf`, p]))), `${base}-แยกหน้า.zip`, "application/zip");
      } else {
        // JPG and PNG embed directly; other formats are converted to PNG first.
        const images = await Promise.all(
          items.map(async ({ file }, i) => {
            if (file.type === "image/jpeg") return { bytes: bytes[i] as Uint8Array, type: "jpg" as const };
            if (file.type === "image/png") return { bytes: bytes[i] as Uint8Array, type: "png" as const };
            const img = await loadImageFile(file);
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d")?.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            return { bytes: new Uint8Array(await (await canvasToBlob(canvas, "image/png")).arrayBuffer()), type: "png" as const };
          }),
        );
        downloadBlob(await imagesToPdf(images, layout), "รูปภาพ.pdf", "application/pdf");
      }
      setMessage({ kind: "success", text: "สร้างไฟล์แล้ว ดูในโฟลเดอร์ดาวน์โหลด" });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="เลือกงาน">
        {(
          [
            ["merge", "รวม PDF"],
            ["split", "แยก/ดึงหน้า"],
            ["images", "รูปเป็น PDF"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id);
              setItems([]);
              setPages(null);
              setMessage(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="btn btn-primary" style={{ justifySelf: "start" }}>
        {mode === "images" ? "เลือกรูป" : multiple ? "เพิ่มไฟล์ PDF" : "เลือกไฟล์ PDF"}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="visually-hidden"
          aria-label={mode === "images" ? "เลือกรูปที่จะทำเป็น PDF" : "เลือกไฟล์ PDF"}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {items.length > 0 && (
        <ol className="file-list" aria-label="ไฟล์ที่เลือก">
          {items.map((item, i) => (
            <li key={item.key}>
              <span>
                {i + 1}. {item.file.name} <span className="muted small">({formatBytes(item.file.size)})</span>
              </span>
              <span className="task-actions">
                {multiple && (
                  <>
                    <button type="button" className="icon-btn small-btn" aria-label={`เลื่อน ${item.file.name} ขึ้น`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp aria-hidden="true" size={14} />
                    </button>
                    <button type="button" className="icon-btn small-btn" aria-label={`เลื่อน ${item.file.name} ลง`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown aria-hidden="true" size={14} />
                    </button>
                  </>
                )}
                <button type="button" className="icon-btn small-btn danger" aria-label={`นำ ${item.file.name} ออก`} onClick={() => setItems((l) => l.filter((x) => x.key !== item.key))}>
                  <X aria-hidden="true" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {mode === "merge" && (
        <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy || items.length < 2} onClick={() => void run("merge")}>
          <Download aria-hidden="true" size={16} /> รวม {items.length} ไฟล์
        </button>
      )}
      {mode === "split" && pages !== null && (
        <>
          <label className="field">
            หน้าที่ต้องการ (มี {pages} หน้า) เช่น 1-3, 5, 8-
            <input className="input" value={ranges} onChange={(e) => setRanges(e.target.value)} />
          </label>
          <div className="button-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run("extract")}>
              <Download aria-hidden="true" size={16} /> ดึงหน้าที่เลือก
            </button>
            <button type="button" className="btn" disabled={busy || pages < 2} onClick={() => void run("split-all")}>
              แยกทุกหน้า (.zip)
            </button>
          </div>
        </>
      )}
      {mode === "images" && (
        <>
          <label className="field inline-field">
            ขนาดหน้า
            <select className="input" value={layout} onChange={(e) => setLayout(e.target.value as "a4" | "fit")}>
              <option value="a4">A4 (จัดกึ่งกลาง)</option>
              <option value="fit">เท่ารูป</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} disabled={busy || items.length === 0} onClick={() => void run("images")}>
            <Download aria-hidden="true" size={16} /> สร้าง PDF ({items.length} หน้า)
          </button>
        </>
      )}
      {busy && <p className="small muted">กำลังทำงาน…</p>}
      {message && (
        <p className={message.kind === "error" ? "error-text" : "success-text"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <p className="muted small">ทำงานในเครื่อง ไฟล์ไม่ถูกอัปโหลด</p>
    </div>
  );
}
