import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Copy, Download, ImageUp } from "lucide-react";
import { COPY_LABEL, useCopy } from "../../hooks/useCopy";
import { downloadText } from "../settings/backup";
import { buildPrompt, colorGrid, dominantColors, formatBytes, toAscii, type ColorShare, type Pixels } from "./analyze";
import { recognizeText, type OcrProgress } from "./ocr";
import "./image-to-text.css";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Large photos are scaled down first: faster OCR and analysis. */
const MAX_SIDE = 2000;

interface Loaded {
  file: { name: string; type: string; size: number };
  url: string;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  pixels: Pixels;
  colors: ColorShare[];
}

type OcrState =
  | { status: "idle" }
  | { status: "running"; progress: OcrProgress }
  | { status: "done"; text: string; confidence: number }
  | { status: "error"; message: string };

async function loadImage(file: File): Promise<Loaded> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("เปิดรูปนี้ไม่ได้ ไฟล์อาจเสียหายหรือเป็นรูปแบบที่เบราว์เซอร์ไม่รองรับ (เช่น HEIC)");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("เบราว์เซอร์นี้ประมวลผลรูปไม่ได้");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: Pixels = { width: data.width, height: data.height, data: data.data };
  return {
    file: { name: file.name || "รูปที่วาง.png", type: file.type, size: file.size },
    url,
    width: img.naturalWidth,
    height: img.naturalHeight,
    canvas,
    pixels,
    colors: dominantColors(pixels),
  };
}

export default function ImageToTextWidget() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useOcr, setUseOcr] = useState(true);
  const [useAscii, setUseAscii] = useState(true);
  const [asciiWidth, setAsciiWidth] = useState(60);
  const [useGrid, setUseGrid] = useState(false);
  const [question, setQuestion] = useState("");
  const [ocr, setOcr] = useState<OcrState>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [copyState, copy] = useCopy();
  const fileInput = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const inputId = useId();

  /** Reads text from the image; a newer run makes older results ignored. */
  const startOcr = (target: Loaded) => {
    const id = ++runId.current;
    setOcr({ status: "running", progress: { stage: "loading", progress: 0 } });
    recognizeText(target.canvas, (progress) => {
      if (runId.current === id) setOcr({ status: "running", progress });
    }).then(
      (result) => {
        if (runId.current === id) setOcr({ status: "done", ...result });
      },
      () => {
        if (runId.current !== id) return;
        setOcr({
          status: "error",
          message: navigator.onLine
            ? "อ่านข้อความไม่สำเร็จ ลองใหม่อีกครั้ง"
            : "ยังอ่านข้อความไม่ได้: ตัวอ่าน (OCR) ต้องดาวน์โหลดตอนออนไลน์ครั้งแรก 1 ครั้ง หลังจากนั้นใช้ออฟไลน์ได้",
        });
      },
    );
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WebP, GIF)");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`รูปใหญ่เกิน ${formatBytes(MAX_FILE_BYTES)}`);
      return;
    }
    setBusy(true);
    try {
      const next = await loadImage(file);
      setLoaded(next);
      if (useOcr) startOcr(next);
      else {
        runId.current++;
        setOcr({ status: "idle" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // Paste an image from the clipboard (e.g. a screenshot) anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        event.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // Free the preview's object URL when the image is replaced or the tool closes.
  useEffect(() => {
    if (!loaded) return;
    return () => URL.revokeObjectURL(loaded.url);
  }, [loaded]);

  const prompt = loaded
    ? buildPrompt({
        fileName: loaded.file.name,
        fileType: loaded.file.type,
        fileSize: loaded.file.size,
        width: loaded.width,
        height: loaded.height,
        question,
        ocrText: useOcr && ocr.status === "done" ? ocr.text : null,
        ocrConfidence: useOcr && ocr.status === "done" ? ocr.confidence : null,
        colors: loaded.colors,
        ascii: useAscii ? toAscii(loaded.pixels, asciiWidth) : null,
        grid: useGrid ? colorGrid(loaded.pixels, 8, Math.max(2, Math.min(12, Math.round((8 * loaded.height) / loaded.width)))) : null,
      })
    : "";

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="stack image-to-text">
      <div
        className={`drop-zone ${dragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {loaded ? (
          <img className="image-preview" src={loaded.url} alt={`รูปที่เลือก: ${loaded.file.name}`} />
        ) : (
          <ImageUp aria-hidden="true" size={40} />
        )}
        <p className="muted small" style={{ margin: 0 }}>
          ลากรูปมาวาง, กด Ctrl+V เพื่อวางภาพหน้าจอ หรือ
        </p>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "กำลังเปิดรูป…" : loaded ? "เลือกรูปอื่น" : "เลือกรูป"}
        </button>
        <input
          id={inputId}
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="เลือกรูปภาพ"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <fieldset className="settings-group image-options">
        <legend>ใส่อะไรในข้อความบ้าง</legend>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={useOcr}
            onChange={(e) => {
              setUseOcr(e.target.checked);
              if (e.target.checked && loaded && ocr.status !== "done") startOcr(loaded);
            }}
          />
          ข้อความในรูป (OCR ไทย/อังกฤษ)
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={useAscii} onChange={(e) => setUseAscii(e.target.checked)} />
          ภาพร่างด้วยตัวอักษร
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={useGrid} onChange={(e) => setUseGrid(e.target.checked)} />
          แผนที่สี
        </label>
        {useAscii && (
          <label className="field" style={{ width: "100%" }}>
            ความละเอียดภาพร่าง: {asciiWidth} ตัวอักษร
            <input type="range" min={30} max={120} step={10} value={asciiWidth} onChange={(e) => setAsciiWidth(Number(e.target.value))} />
          </label>
        )}
      </fieldset>

      <label className="field">
        คำถามถึง AI (ไม่บังคับ)
        <input className="input" placeholder="เช่น รูปนี้คืออะไร / สรุปเอกสารนี้ / ยอดโอนเท่าไร" value={question} onChange={(e) => setQuestion(e.target.value)} />
      </label>

      {loaded && useOcr && ocr.status === "running" && (
        <div className="stack" role="status">
          <span className="small muted">
            {ocr.progress.stage === "loading" ? "กำลังเตรียมตัวอ่านข้อความ (ครั้งแรกดาวน์โหลดประมาณ 4–8 MB)…" : `กำลังอ่านข้อความ ${Math.round(ocr.progress.progress * 100)}%`}
          </span>
          <progress max={1} value={ocr.progress.progress} aria-label="ความคืบหน้าการอ่านข้อความ" />
        </div>
      )}
      {loaded && useOcr && ocr.status === "error" && (
        <p className="notice" role="status">
          {ocr.message}{" "}
          <button type="button" className="btn small" onClick={() => startOcr(loaded)}>
            ลองอีกครั้ง
          </button>
        </p>
      )}

      {loaded && (
        <section className="stack" aria-labelledby={`${inputId}-out`}>
          <h3 id={`${inputId}-out`} className="settings-heading">
            ข้อความสำหรับวางในแชท AI
          </h3>
          <textarea className="input prompt-output" readOnly rows={14} value={prompt} aria-label="ข้อความสำหรับวางในแชท AI" />
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={() => copy(prompt)}>
              <Copy aria-hidden="true" size={16} /> {COPY_LABEL[copyState]}
            </button>
            <button type="button" className="btn" onClick={() => downloadText(prompt, `${loaded.file.name.replace(/\.[^.]+$/, "")}-สำหรับAI.txt`, "text/plain")}>
              <Download aria-hidden="true" size={16} /> ดาวน์โหลด .txt
            </button>
            <span className="small muted">{prompt.length.toLocaleString("th-TH")} ตัวอักษร</span>
          </div>
          {prompt.length > 8000 && <p className="small muted">ยาวเกินไปสำหรับบางแชท ลองลดความละเอียดภาพร่างหรือปิดแผนที่สี</p>}
        </section>
      )}
      <p className="muted small">
        ประมวลผลในเครื่องนี้ทั้งหมด รูปไม่ถูกอัปโหลดไปที่ใด · AI จะเข้าใจรูปจากข้อความได้ไม่ครบเท่าเห็นรูปจริง เหมาะกับรูปเอกสาร/ภาพหน้าจอที่มีตัวหนังสือที่สุด · ตัวหนังสือสีอ่อนบนพื้นเข้ม หรือตัวเล็กมาก อาจอ่านไม่ออก ลองครอปรูปให้เหลือส่วนที่ต้องการก่อน
      </p>
    </div>
  );
}
