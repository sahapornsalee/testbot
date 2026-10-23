import { useId, useState } from "react";
import { formatBaht } from "../money/expenses";
import { makeQr, qrPath } from "../dev-tools/qr";
import { parseTarget, promptPayPayload, validateAmount } from "./promptpay";
import "../dev-tools/devtools.css";

const MARGIN = 4;

export default function PromptPayWidget() {
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const titleId = useId();
  const parsed = parseTarget(target);
  const amountResult = validateAmount(amount);
  const payload = parsed && amountResult.ok ? promptPayPayload(parsed, amountResult.value) : null;
  const qr = payload ? makeQr(payload, "M") : null;

  return (
    <div className="stack">
      <div className="field-row">
        <label className="field">
          เบอร์มือถือ / เลขบัตรประชาชน / e-Wallet ที่ผูกพร้อมเพย์
          <input className="input" inputMode="numeric" placeholder="เช่น 0812345678" value={target} aria-invalid={target !== "" && !parsed} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="field">
          จำนวนเงิน (ไม่บังคับ)
          <input className="input" inputMode="decimal" placeholder="ปล่อยว่างให้ผู้โอนกรอกเอง" value={amount} aria-invalid={!amountResult.ok} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>
      {target !== "" && !parsed && (
        <p className="error-text small" role="alert">
          ใส่เบอร์มือถือ 10 หลัก เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก หรือ e-Wallet 15 หลัก
        </p>
      )}
      {!amountResult.ok && (
        <p className="error-text small" role="alert">
          {amountResult.error}
        </p>
      )}
      {qr?.ok && parsed && (
        <div className="qr-box">
          <svg className="qr-image" xmlns="http://www.w3.org/2000/svg" viewBox={`${-MARGIN} ${-MARGIN} ${qr.value.size + MARGIN * 2} ${qr.value.size + MARGIN * 2}`} shapeRendering="crispEdges" role="img" aria-labelledby={titleId}>
            <title id={titleId}>QR พร้อมเพย์</title>
            <rect x={-MARGIN} y={-MARGIN} width={qr.value.size + MARGIN * 2} height={qr.value.size + MARGIN * 2} fill="#ffffff" />
            <path d={qrPath(qr.value)} fill="#000000" />
          </svg>
          <strong>
            พร้อมเพย์ {parsed.kind === "phone" ? `เบอร์ ${parsed.value.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}` : parsed.kind === "id" ? "เลขประจำตัว" : "e-Wallet"}
          </strong>
          <span>{amountResult.ok && amountResult.value ? `${formatBaht(amountResult.value)} บาท` : "ผู้โอนกรอกจำนวนเงินเอง"}</span>
        </div>
      )}
      <p className="muted small">สร้างในเครื่อง ไม่ผ่านธนาคาร ให้ผู้โอนตรวจชื่อบัญชีในแอปธนาคารก่อนยืนยันทุกครั้ง</p>
    </div>
  );
}
