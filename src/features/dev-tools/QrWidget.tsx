import { useId, useRef, useState } from "react";
import { Download } from "lucide-react";
import { makeQr, qrPath, wifiPayload, type QrLevel } from "./qr";
import "./devtools.css";

type Mode = "text" | "wifi";
const MARGIN = 4;

export default function QrWidget() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("https://sahapornsalee.github.io/testbot/");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [level, setLevel] = useState<QrLevel>("M");
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  const payload = mode === "text" ? text : ssid.trim() ? wifiPayload(ssid, password, security, false) : "";
  const result = makeQr(payload, level);

  const download = () => {
    const svg = svgRef.current;
    if (!svg || !result.ok) return;
    const size = (result.value.size + MARGIN * 2) * 10;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = "qrcode.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  };

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="ชนิด QR">
        <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>
          ข้อความ / ลิงก์
        </button>
        <button type="button" aria-pressed={mode === "wifi"} onClick={() => setMode("wifi")}>
          Wi-Fi
        </button>
      </div>
      {mode === "text" ? (
        <label className="field">
          ข้อความหรือลิงก์
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      ) : (
        <div className="field-row">
          <label className="field">
            ชื่อ Wi-Fi (SSID)
            <input className="input" value={ssid} onChange={(e) => setSsid(e.target.value)} />
          </label>
          <label className="field">
            รหัสผ่าน
            <input className="input" value={password} disabled={security === "nopass"} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            ความปลอดภัย
            <select className="input" value={security} onChange={(e) => setSecurity(e.target.value as typeof security)}>
              <option value="WPA">WPA/WPA2/WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">ไม่มีรหัสผ่าน</option>
            </select>
          </label>
        </div>
      )}
      <label className="field inline-field">
        ระดับแก้ไขข้อผิดพลาด
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value as QrLevel)}>
          <option value="L">ต่ำ (L) ความจุมากสุด</option>
          <option value="M">กลาง (M)</option>
          <option value="Q">สูง (Q)</option>
          <option value="H">สูงสุด (H) ทนรอยเปื้อน</option>
        </select>
      </label>
      {result.ok ? (
        <div className="qr-box">
          <svg
            ref={svgRef}
            className="qr-image"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${-MARGIN} ${-MARGIN} ${result.value.size + MARGIN * 2} ${result.value.size + MARGIN * 2}`}
            shapeRendering="crispEdges"
            role="img"
            aria-labelledby={titleId}
          >
            <title id={titleId}>QR Code: {mode === "wifi" ? `Wi-Fi ${ssid}` : text.slice(0, 80)}</title>
            <rect x={-MARGIN} y={-MARGIN} width={result.value.size + MARGIN * 2} height={result.value.size + MARGIN * 2} fill="#ffffff" />
            <path d={qrPath(result.value)} fill="#000000" />
          </svg>
          <button type="button" className="btn small" onClick={download}>
            <Download aria-hidden="true" size={16} /> ดาวน์โหลด PNG
          </button>
        </div>
      ) : (
        <p className={payload ? "error-text" : "muted"} role={payload ? "alert" : undefined}>
          {mode === "wifi" && !ssid.trim() ? "กรุณาใส่ชื่อ Wi-Fi" : result.error}
        </p>
      )}
    </div>
  );
}
