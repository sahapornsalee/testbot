import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Download, Eraser, Save, Trash2 } from "lucide-react";
import { readJson, removeKey, writeJson } from "../../lib/storage";
import { canvasToBlob, downloadBlob, loadImageFile } from "./download";
import { previewBoxToPdf, stampImage } from "./pdfOps";
import { dataUrlToBytes, inkBounds, parseSignature, SIGNATURE_KEY } from "./signature";
import "./files.css";

export default function SignatureWidget() {
  const [stored, setStoredState] = useState(() => readJson(SIGNATURE_KEY, parseSignature, null).value);
  const [saveError, setSaveError] = useState(false);
  const setStored = (value: { version: 1; dataUrl: string } | null) => {
    setStoredState(value);
    if (value) setSaveError(!writeJson(SIGNATURE_KEY, value));
    else removeKey(SIGNATURE_KEY);
  };
  const [drawing, setDrawing] = useState(stored === null);
  return (
    <div className="stack">
      {drawing || !stored ? (
        <SignaturePad
          onSave={(dataUrl) => {
            setStored({ version: 1, dataUrl });
            setDrawing(false);
          }}
          onCancel={stored ? () => setDrawing(false) : undefined}
        />
      ) : (
        <>
          <div className="button-row">
            <img src={stored.dataUrl} alt="ลายเซ็นที่บันทึกไว้" style={{ maxHeight: 80, background: "#fff", borderRadius: 8, padding: 8 }} />
          </div>
          <div className="button-row">
            <button type="button" className="btn" onClick={() => setDrawing(true)}>
              เซ็นใหม่
            </button>
            <button type="button" className="btn" onClick={() => downloadBlob(dataUrlToBytes(stored.dataUrl), "ลายเซ็น.png", "image/png")}>
              <Download aria-hidden="true" size={16} /> ดาวน์โหลด PNG (พื้นใส)
            </button>
            <button
              type="button"
              className="icon-btn danger"
              aria-label="ลบลายเซ็นที่บันทึกไว้"
              onClick={() => {
                if (window.confirm("ลบลายเซ็นที่บันทึกไว้ในเครื่องนี้?")) {
                  setStored(null);
                  setDrawing(true);
                }
              }}
            >
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </div>
          <PlaceSignature signature={stored.dataUrl} />
        </>
      )}
      {saveError && (
        <p className="notice" role="status">
          บันทึกลายเซ็นไว้ในเครื่องไม่สำเร็จ ใช้ได้จนกว่าจะปิดหน้านี้
        </p>
      )}
      <p className="muted small">ลายเซ็นเก็บเฉพาะในเครื่องนี้ ระวังการใช้บนเครื่องที่คนอื่นใช้ร่วม</p>
    </div>
  );
}

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: (() => void) | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#1e3a8a");
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.round(box.width * 2);
    canvas.height = Math.round(box.height * 2);
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * e.currentTarget.width, y: ((e.clientY - box.top) / box.height) * e.currentTarget.height };
  };

  const save = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const bounds = inkBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!bounds) return;
    const pad = 12;
    const out = document.createElement("canvas");
    out.width = bounds.width + pad * 2;
    out.height = bounds.height + pad * 2;
    out.getContext("2d")?.drawImage(canvas, bounds.x - pad, bounds.y - pad, out.width, out.height, 0, 0, out.width, out.height);
    onSave(out.toDataURL("image/png"));
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        aria-label="ช่องเซ็นชื่อ ใช้นิ้วหรือเมาส์เขียน"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = point(e);
        }}
        onPointerMove={(e) => {
          const ctx = e.currentTarget.getContext("2d");
          if (!last.current || !ctx) return;
          const p = point(e);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(3, (e.pressure || 0.5) * 8);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          setEmpty(false);
        }}
        onPointerUp={() => {
          last.current = null;
        }}
      />
      <div className="button-row">
        <label className="field inline-field">
          สีหมึก
          <select className="input" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="#1e3a8a">น้ำเงิน</option>
            <option value="#000000">ดำ</option>
          </select>
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const c = canvasRef.current;
            c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
          }}
        >
          <Eraser aria-hidden="true" size={16} /> ล้าง
        </button>
        <button type="button" className="btn btn-primary" disabled={empty} onClick={save}>
          <Save aria-hidden="true" size={16} /> บันทึกลายเซ็น
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            ยกเลิก
          </button>
        )}
      </div>
    </>
  );
}

const PREVIEW_SCALE = 1.5;

function PlaceSignature({ signature }: { signature: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<{ kind: "pdf"; name: string; bytes: Uint8Array; pdf: PDFDocumentProxy; pages: number } | { kind: "image"; name: string; img: HTMLImageElement } | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(160);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sigImage, setSigImage] = useState<HTMLImageElement | null>(null);
  const [pageSize, setPageSize] = useState<{ height: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSigImage(img);
    img.src = signature;
  }, [signature]);

  const sigBox = (canvasWidth: number) => {
    if (!sigImage || !spot) return null;
    const w = Math.min(width * (doc?.kind === "pdf" ? PREVIEW_SCALE : canvasWidth / 800), canvasWidth);
    const h = (w * sigImage.height) / sigImage.width;
    return { x: spot.x - w / 2, y: spot.y - h / 2, width: w, height: h };
  };

  // Draw the page or image, then the signature where the user clicked.
  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !doc) return;
      let base: HTMLCanvasElement | HTMLImageElement;
      if (doc.kind === "pdf") {
        const { renderPage } = await import("./pdf");
        base = await renderPage(doc.pdf, page, PREVIEW_SCALE);
        const p = await doc.pdf.getPage(page);
        if (!cancelled) setPageSize({ height: p.getViewport({ scale: 1 }).height });
      } else base = doc.img;
      if (cancelled) return;
      canvas.width = base instanceof HTMLImageElement ? base.naturalWidth : base.width;
      canvas.height = base instanceof HTMLImageElement ? base.naturalHeight : base.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(base, 0, 0);
      const box = sigBox(canvas.width);
      if (ctx && box && sigImage) ctx.drawImage(sigImage, box.x, box.y, box.width, box.height);
    };
    void draw();
    return () => {
      cancelled = true;
    };
  });

  const open = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSpot(null);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { openPdf } = await import("./pdf");
        const pdf = await openPdf(bytes);
        setDoc({ kind: "pdf", name: file.name, bytes, pdf, pages: pdf.numPages });
        setPage(1);
      } else if (file.type.startsWith("image/")) {
        setDoc({ kind: "image", name: file.name, img: await loadImageFile(file) });
      } else setError("เลือกไฟล์ PDF หรือรูปภาพ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดไฟล์ไม่ได้");
    }
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!doc || !canvas || !spot) return;
    try {
      if (doc.kind === "image") {
        downloadBlob(await canvasToBlob(canvas, "image/png"), `${doc.name.replace(/\.[^.]+$/, "")}-เซ็นแล้ว.png`);
      } else {
        const box = sigBox(canvas.width);
        if (!box || !pageSize) return;
        const out = await stampImage(doc.bytes, page - 1, dataUrlToBytes(signature), previewBoxToPdf(box, PREVIEW_SCALE, pageSize.height));
        downloadBlob(out, `${doc.name.replace(/\.pdf$/i, "")}-เซ็นแล้ว.pdf`, "application/pdf");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <section className="stack" aria-labelledby="place-title">
      <h3 id="place-title" className="settings-heading">
        วางลายเซ็นบนเอกสาร
      </h3>
      <label className="btn" style={{ justifySelf: "start" }}>
        เลือก PDF หรือรูปเอกสาร
        <input type="file" accept="application/pdf,.pdf,image/*" className="visually-hidden" aria-label="เลือกเอกสารที่จะเซ็น" onChange={(e) => void open(e.target.files?.[0])} />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {doc && (
        <>
          <div className="button-row">
            {doc.kind === "pdf" && (
              <label className="field inline-field">
                หน้า
                <select
                  className="input"
                  value={page}
                  onChange={(e) => {
                    setPage(Number(e.target.value));
                    setSpot(null);
                  }}
                >
                  {Array.from({ length: doc.pages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field inline-field">
              ขนาดลายเซ็น
              <input type="range" min={60} max={400} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
            </label>
          </div>
          <p className="small muted">คลิกบนเอกสารตรงที่ต้องการวางลายเซ็น</p>
          <canvas
            ref={canvasRef}
            className="place-canvas"
            aria-label="ตัวอย่างเอกสาร คลิกเพื่อวางลายเซ็น"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setSpot({ x: ((e.clientX - box.left) / box.width) * e.currentTarget.width, y: ((e.clientY - box.top) / box.height) * e.currentTarget.height });
            }}
          />
          <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} disabled={!spot} onClick={() => void save()}>
            <Download aria-hidden="true" size={16} /> ดาวน์โหลดเอกสารที่เซ็นแล้ว
          </button>
        </>
      )}
    </section>
  );
}
