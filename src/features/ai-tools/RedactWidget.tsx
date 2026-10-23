import { useRef, useState, type PointerEvent } from "react";
import { Download, Undo2 } from "lucide-react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { takeHandoff } from "../../lib/handoff";
import { PII_LABELS, redact, type PiiKind } from "./redact";
import "./ai-tools.css";

const KINDS: PiiKind[] = ["thai-id", "phone", "email", "card", "bank", "custom"];

export default function RedactWidget() {
  const [mode, setMode] = useState<"text" | "image">("text");
  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="ชนิดข้อมูล">
        <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>
          ข้อความ
        </button>
        <button type="button" aria-pressed={mode === "image"} onClick={() => setMode("image")}>
          รูปภาพ
        </button>
      </div>
      {mode === "text" ? <TextRedactor /> : <ImageRedactor />}
      <p className="muted small">ทำงานในเครื่องเท่านั้น ตรวจผลลัพธ์อีกครั้งก่อนส่ง ระบบอาจไม่พบข้อมูลบางรูปแบบ</p>
    </div>
  );
}

function TextRedactor() {
  const [text, setText] = useState(() => takeHandoff("redact") ?? "");
  const [kinds, setKinds] = useState<Set<PiiKind>>(new Set(KINDS));
  const [words, setWords] = useState("");
  const [style, setStyle] = useState<"label" | "block">("label");
  const [copyState, copy] = useCopy();
  const result = redact(text, { kinds, customWords: words.split(/[,\n]/), style });
  const counts = KINDS.map((k) => [k, result.matches.filter((m) => m.kind === k).length] as const).filter(([, n]) => n > 0);

  return (
    <>
      <label className="field">
        ข้อความต้นฉบับ
        <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <fieldset className="settings-group">
        <legend>ปิดข้อมูลชนิดใดบ้าง</legend>
        {KINDS.map((k) => (
          <label key={k} className="checkbox-label">
            <input
              type="checkbox"
              checked={kinds.has(k)}
              onChange={(e) =>
                setKinds((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(k);
                  else next.delete(k);
                  return next;
                })
              }
            />
            {PII_LABELS[k]}
          </label>
        ))}
      </fieldset>
      {kinds.has("custom") && (
        <label className="field">
          คำที่ต้องการปิดเพิ่ม เช่น ชื่อ-นามสกุล ที่อยู่ (คั่นด้วยจุลภาค)
          <input className="input" value={words} onChange={(e) => setWords(e.target.value)} />
        </label>
      )}
      <label className="field inline-field">
        แสดงเป็น
        <select className="input" value={style} onChange={(e) => setStyle(e.target.value as "label" | "block")}>
          <option value="label">[ชื่อชนิดข้อมูล]</option>
          <option value="block">███</option>
        </select>
      </label>
      {text && (
        <>
          <div className="chip-row" role="status" aria-label="ข้อมูลที่พบ">
            {counts.length === 0 ? (
              <span className="chip">ไม่พบข้อมูลส่วนตัว</span>
            ) : (
              counts.map(([k, n]) => (
                <span key={k} className="chip">
                  {PII_LABELS[k]} {n}
                </span>
              ))
            )}
          </div>
          <textarea className="input" rows={6} readOnly aria-label="ข้อความที่ปิดข้อมูลแล้ว" value={result.text} />
          <button type="button" className="btn btn-primary" onClick={() => copy(result.text)}>
            {COPY_LABEL[copyState]}
          </button>
        </>
      )}
    </>
  );
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_SIDE = 2400;

function ImageRedactor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [style, setStyle] = useState<"black" | "pixelate">("black");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  const paint = (all: Rect[], current: Rect | null, mode = style) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const r of all) {
      if (mode === "black") {
        ctx.fillStyle = "#000";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else {
        const block = Math.max(8, Math.round(Math.max(canvas.width, canvas.height) / 60));
        for (let y = r.y; y < r.y + r.h; y += block) {
          for (let x = r.x; x < r.x + r.w; x += block) {
            const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            ctx.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`;
            ctx.fillRect(x, y, Math.min(block, r.x + r.w - x), Math.min(block, r.y + r.h - y));
          }
        }
      }
    }
    if (current) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(2, canvas.width / 400);
      ctx.strokeRect(current.x, current.y, current.w, current.h);
    }
  };

  const load = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setError(null);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    try {
      await img.decode();
    } catch {
      setError("เปิดรูปนี้ไม่ได้");
      return;
    }
    imageRef.current = img;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    setRects([]);
    setLoaded(true);
    paint([], null);
  };

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const box = canvas.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * canvas.width, y: ((e.clientY - box.top) / box.height) * canvas.height };
  };

  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  return (
    <>
      <div className="button-row">
        <label className="btn btn-primary">
          เลือกรูป
          <input type="file" accept="image/*" className="visually-hidden" aria-label="เลือกรูปที่จะปิดข้อมูล" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
        <label className="field inline-field">
          แบบ
          <select
            className="input"
            value={style}
            onChange={(e) => {
              const next = e.target.value as "black" | "pixelate";
              setStyle(next);
              paint(rects, null, next);
            }}
          >
            <option value="black">แถบดำทึบ</option>
            <option value="pixelate">เบลอเป็นช่อง</option>
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={rects.length === 0}
          onClick={() => {
            const next = rects.slice(0, -1);
            setRects(next);
            paint(next, null);
          }}
        >
          <Undo2 aria-hidden="true" size={16} /> ย้อนกลับ
        </button>
        <button
          type="button"
          className="btn"
          disabled={!loaded}
          onClick={() =>
            canvasRef.current?.toBlob((blob) => {
              if (!blob) return;
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = "รูปที่ปิดข้อมูลแล้ว.png";
              link.click();
              setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            }, "image/png")
          }
        >
          <Download aria-hidden="true" size={16} /> ดาวน์โหลด
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <canvas
        ref={canvasRef}
        className="redact-canvas"
        hidden={!loaded}
        aria-label={`รูปสำหรับปิดข้อมูล ลากเพื่อวาดกรอบ (ปิดไปแล้ว ${rects.length} ส่วน)`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = point(e);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const r = rectFrom(drag.current, point(e));
          setDraft(r);
          paint(rects, r);
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const r = rectFrom(drag.current, point(e));
          drag.current = null;
          setDraft(null);
          const next = r.w > 3 && r.h > 3 ? [...rects, r] : rects;
          setRects(next);
          paint(next, null);
        }}
      />
      {loaded && <p className="small muted">ลากบนรูปเพื่อคลุมส่วนที่ต้องการซ่อน{draft ? "" : ` · ปิดแล้ว ${rects.length} ส่วน`} · รูปที่ดาวน์โหลดไม่มีข้อมูลกล้อง/พิกัด</p>}
    </>
  );
}
