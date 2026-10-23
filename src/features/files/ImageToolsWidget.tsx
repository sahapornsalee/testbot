import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Crop, Download, FlipHorizontal, MapPin, RotateCw } from "lucide-react";
import { formatBytes } from "../image-to-text/analyze";
import { canvasToBlob, downloadBlob, loadImageFile } from "./download";
import { readExif, type ExifInfo } from "./exif";
import { clampCrop, fitSize, outputName, rotatedSize, type CropRect, type ImageFormat } from "./imageMath";
import "./files.css";

interface Source {
  name: string;
  size: number;
  img: HTMLImageElement;
  exif: ExifInfo | null;
}

export default function ImageToolsWidget() {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropping, setCropping] = useState(false);
  const [maxSide, setMaxSide] = useState(1920);
  const [format, setFormat] = useState<ImageFormat>("image/jpeg");
  const [quality, setQuality] = useState(0.85);
  const [estimate, setEstimate] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<CropRect | null>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    try {
      const exif = file.type === "image/jpeg" ? readExif(await file.arrayBuffer()) : null;
      const img = await loadImageFile(file);
      setSource({ name: file.name, size: file.size, img, exif });
      setRotation(0);
      setFlip(false);
      setCrop(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดรูปไม่สำเร็จ");
    }
  };

  // Free the decoded image's object URL when it is replaced or the tool closes.
  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source.img.src);
  }, [source]);

  /** Draws the edited image: rotate/flip the source, then crop, then resize. */
  const render = (target: HTMLCanvasElement, withCrop: boolean) => {
    if (!source) return;
    const { img } = source;
    const turned = rotatedSize(img.naturalWidth, img.naturalHeight, rotation);
    const area = withCrop && crop ? crop : { x: 0, y: 0, width: turned.width, height: turned.height };
    const out = fitSize(area.width, area.height, maxSide, maxSide);
    target.width = out.width;
    target.height = out.height;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
    }
    const scale = out.width / area.width;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-area.x, -area.y);
    ctx.translate(turned.width / 2, turned.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  // Preview shows the whole (rotated) image so a crop can be drawn on it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    render(canvas, !cropping);
    // While cropping, darken everything outside the chosen box.
    const ctx = canvas.getContext("2d");
    const box = draft ?? crop;
    if (ctx && box && cropping) {
      const s = canvas.width / rotatedSize(source.img.naturalWidth, source.img.naturalHeight, rotation).width;
      const [x, y, w, h] = [box.x * s, box.y * s, box.width * s, box.height * s];
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
    let cancelled = false;
    const out = document.createElement("canvas");
    render(out, true);
    void canvasToBlob(out, format, quality).then(
      (blob) => !cancelled && setEstimate(blob.size),
      () => !cancelled && setEstimate(null),
    );
    return () => {
      cancelled = true;
    };
  });

  const toImage = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const turned = rotatedSize(source!.img.naturalWidth, source!.img.naturalHeight, rotation);
    return { x: ((e.clientX - rect.left) / rect.width) * turned.width, y: ((e.clientY - rect.top) / rect.height) * turned.height };
  };

  const save = async () => {
    if (!source) return;
    const out = document.createElement("canvas");
    render(out, true);
    try {
      downloadBlob(await canvasToBlob(out, format, quality), outputName(source.name, format));
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="stack">
      <label className="btn btn-primary" style={{ justifySelf: "start" }}>
        {source ? "เลือกรูปอื่น" : "เลือกรูป"}
        <input
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="เลือกรูปที่จะแก้ไข"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {source && (
        <>
          {source.exif?.gps && (
            <p className="notice" role="status">
              <MapPin aria-hidden="true" size={16} /> รูปนี้มีพิกัดที่ถ่าย ({source.exif.gps.lat}, {source.exif.gps.lng}) — ไฟล์ที่ดาวน์โหลดจากเครื่องมือนี้จะลบพิกัดและข้อมูลกล้องออกให้แล้ว
            </p>
          )}
          {source.exif && !source.exif.gps && (source.exif.make || source.exif.dateTime) && (
            <p className="small muted">
              ข้อมูลในไฟล์: {[source.exif.make, source.exif.model, source.exif.dateTime].filter(Boolean).join(" · ")} (จะถูกลบเมื่อดาวน์โหลด)
            </p>
          )}
          <canvas
            ref={canvasRef}
            className={`edit-canvas ${cropping ? "is-cropping" : ""}`}
            aria-label={cropping ? "ลากเพื่อเลือกส่วนที่จะครอป" : "ตัวอย่างรูปที่แก้ไขแล้ว"}
            onPointerDown={(e) => {
              if (!cropping) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = toImage(e);
            }}
            onPointerMove={(e) => {
              if (!cropping || !drag.current) return;
              const p = toImage(e);
              setDraft({ x: Math.min(p.x, drag.current.x), y: Math.min(p.y, drag.current.y), width: Math.abs(p.x - drag.current.x), height: Math.abs(p.y - drag.current.y) });
            }}
            onPointerUp={() => {
              if (!cropping || !drag.current || !draft) return;
              drag.current = null;
              const turned = rotatedSize(source.img.naturalWidth, source.img.naturalHeight, rotation);
              setCrop(clampCrop(draft, turned.width, turned.height));
              setDraft(null);
            }}
          />
          <div className="button-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setRotation((r) => (r + 90) % 360);
                setCrop(null);
              }}
            >
              <RotateCw aria-hidden="true" size={16} /> หมุน 90°
            </button>
            <button type="button" className="btn" aria-pressed={flip} onClick={() => setFlip((f) => !f)}>
              <FlipHorizontal aria-hidden="true" size={16} /> กลับซ้าย-ขวา
            </button>
            <button type="button" className={`btn ${cropping ? "btn-primary" : ""}`} aria-pressed={cropping} onClick={() => setCropping((c) => !c)}>
              <Crop aria-hidden="true" size={16} /> {cropping ? "ครอปเสร็จ" : "ครอป"}
            </button>
            {crop && (
              <button type="button" className="btn small" onClick={() => setCrop(null)}>
                ยกเลิกครอป
              </button>
            )}
          </div>
          <div className="field-row">
            <label className="field">
              ด้านยาวสุดไม่เกิน
              <select className="input" value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))}>
                {[640, 1024, 1280, 1920, 2560, 4096, 0].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "ขนาดเดิม" : `${n} px`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ชนิดไฟล์
              <select className="input" value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)}>
                <option value="image/jpeg">JPG (รูปถ่าย ไฟล์เล็ก)</option>
                <option value="image/webp">WebP (เล็กที่สุด)</option>
                <option value="image/png">PNG (คมชัด/พื้นใส)</option>
              </select>
            </label>
            {format !== "image/png" && (
              <label className="field">
                คุณภาพ {Math.round(quality * 100)}%
                <input type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </label>
            )}
          </div>
          <p className="small" role="status">
            เดิม {formatBytes(source.size)} ({source.img.naturalWidth}×{source.img.naturalHeight}) → ใหม่ประมาณ {estimate !== null ? formatBytes(estimate) : "…"}
          </p>
          <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => void save()}>
            <Download aria-hidden="true" size={16} /> ดาวน์โหลดรูป
          </button>
        </>
      )}
      <p className="muted small">แก้ไขในเครื่อง ไม่อัปโหลด ไฟล์ที่ได้ไม่มีข้อมูลกล้องและพิกัด GPS</p>
    </div>
  );
}
