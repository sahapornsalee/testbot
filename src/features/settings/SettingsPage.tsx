import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { useLayout } from "../dashboard/LayoutContext";
import {
  applyBackup,
  backupFileName,
  buildBackup,
  clearAllData,
  collectCurrentData,
  downloadJson,
  readBackupFile,
  type ParsedBackup,
} from "./backup";
import { useNow } from "../../hooks/useNow";
import { deviceTimeZone, formatDateTime, formatLongDate, formatTime, type DateLocale } from "../../lib/datetime";
import { PRESET_ZONES } from "../life/worldClock";
import { useSettings } from "./SettingsContext";
import { DEVICE_ZONE, type ThemePreference, type TimeFormat } from "./settings";
import "./settings.css";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "สว่าง" },
  { value: "dark", label: "มืด" },
  { value: "system", label: "ตามระบบ" },
];

const DATE_LOCALE_OPTIONS: { value: DateLocale; label: string }[] = [
  { value: "th", label: "ไทย (พ.ศ.)" },
  { value: "en-GB", label: "อังกฤษ UK (ค.ศ.)" },
];

/** Thailand first, then England, then the rest of the presets. */
const ZONE_OPTIONS = [
  { zone: "Asia/Bangkok", label: "ประเทศไทย (กรุงเทพฯ)" },
  { zone: "Europe/London", label: "อังกฤษ (ลอนดอน)" },
  ...PRESET_ZONES.filter((p) => p.zone !== "Asia/Bangkok" && p.zone !== "Europe/London"),
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: "24h", label: "24 ชั่วโมง" },
  { value: "12h", label: "12 ชั่วโมง" },
];

type Message = { kind: "success" | "error" | "info"; text: string } | null;

/** Reloads so every provider re-reads storage after a bulk change. */
function reloadApp() {
  window.location.reload();
}

export function SettingsPage() {
  const { settings, updateSettings, dateTime } = useSettings();
  const now = new Date(useNow(1000));
  const { reset } = useLayout();
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    setBusy(true);
    try {
      const now = new Date();
      downloadJson(buildBackup(await collectCurrentData(), now), backupFileName(now));
      setMessage({ kind: "success", text: "ดาวน์โหลดไฟล์สำรองแล้ว เก็บไฟล์ไว้ในที่ปลอดภัย" });
    } catch {
      setMessage({ kind: "error", text: "สำรองข้อมูลไม่สำเร็จ อ่านพื้นที่เก็บข้อมูลไม่ได้" });
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setPending(null);
    const result = await readBackupFile(file);
    if (fileInput.current) fileInput.current.value = "";
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setPending(result);
    setMessage(null);
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const ok = await applyBackup(pending.data);
      if (!ok) throw new Error("write failed");
      setMessage({ kind: "success", text: "นำเข้าข้อมูลสำเร็จ กำลังโหลดใหม่…" });
      setTimeout(reloadApp, 600);
    } catch {
      setMessage({ kind: "error", text: "นำเข้าข้อมูลไม่สำเร็จ ข้อมูลเดิมอาจยังอยู่บางส่วน ลองนำเข้าอีกครั้ง" });
      setBusy(false);
    }
  };

  const clearData = async () => {
    if (!window.confirm("ลบข้อมูลทั้งหมด (งาน บันทึก บัญชี ข้อมูลเครื่องมือ การตั้งค่า และ Dashboard)? การลบนี้ย้อนกลับไม่ได้ ควรสำรองข้อมูลก่อน")) return;
    setBusy(true);
    try {
      await clearAllData();
      reloadApp();
    } catch {
      setMessage({ kind: "error", text: "ลบข้อมูลไม่สำเร็จ" });
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">ตั้งค่า</h1>
      <p className="page-subtitle">ข้อมูลทั้งหมดเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ได้ส่งออกนอกอุปกรณ์</p>

      <div className="settings-layout">
        <section className="card settings-card" aria-labelledby="appearance">
          <h2 id="appearance" className="settings-section-title">
            การแสดงผล
          </h2>
          <fieldset className="settings-group">
            <legend>ธีม</legend>
            {THEME_OPTIONS.map((option) => (
              <label key={option.value} className="settings-option">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={settings.theme === option.value}
                  onChange={() => updateSettings({ theme: option.value })}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="settings-group">
            <legend>รูปแบบเวลา</legend>
            {TIME_OPTIONS.map((option) => (
              <label key={option.value} className="settings-option">
                <input
                  type="radio"
                  name="timeFormat"
                  value={option.value}
                  checked={settings.timeFormat === option.value}
                  onChange={() => updateSettings({ timeFormat: option.value })}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="settings-group">
            <legend>รูปแบบวันที่</legend>
            {DATE_LOCALE_OPTIONS.map((option) => (
              <label key={option.value} className="settings-option">
                <input
                  type="radio"
                  name="dateLocale"
                  value={option.value}
                  checked={settings.dateLocale === option.value}
                  onChange={() => updateSettings({ dateLocale: option.value })}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="settings-group">
            <label className="field" style={{ width: "100%" }}>
              <span className="settings-heading">เขตเวลา</span>
              <select className="input" value={settings.timeZone} onChange={(e) => updateSettings({ timeZone: e.target.value })}>
                {ZONE_OPTIONS.map((z) => (
                  <option key={z.zone} value={z.zone}>
                    {z.label}
                  </option>
                ))}
                <option value={DEVICE_ZONE}>ตามอุปกรณ์นี้ ({deviceTimeZone()})</option>
              </select>
            </label>
            <p className="settings-help" role="status">
              ตอนนี้: {formatLongDate(now, dateTime)} เวลา {formatTime(now, dateTime, settings.timeFormat === "12h", false)}
            </p>
          </div>

          <div className="settings-group">
            <h3 className="settings-heading">Dashboard</h3>
            <p className="settings-help">จัดลำดับ ปรับขนาด และซ่อนวิดเจ็ตได้จากปุ่ม “ปรับแต่ง” ในหน้า Dashboard</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                reset();
                setMessage({ kind: "success", text: "คืนค่า Dashboard เริ่มต้นแล้ว" });
              }}
            >
              คืนค่า Dashboard เริ่มต้น
            </button>
          </div>

          <div className="settings-group">
            <h3 className="settings-heading">ภาษา</h3>
            <p className="settings-help">ขณะนี้รองรับภาษาไทย</p>
          </div>
        </section>

        <section className="card settings-card" aria-labelledby="data">
          <h2 id="data" className="settings-section-title">
            ข้อมูลและการสำรอง
          </h2>
          <p className="settings-help">
            ข้อมูลในเบราว์เซอร์อาจถูกล้างได้ (เช่น ล้างประวัติ หรือพื้นที่เต็ม) และไม่ซิงก์ข้ามอุปกรณ์ ควรสำรองเป็นไฟล์ไว้เป็นระยะ
            และใช้ไฟล์นี้ย้ายข้อมูลไปเครื่องอื่นได้
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={exportData}>
              <Download aria-hidden="true" size={16} /> สำรองข้อมูล (ส่งออก)
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" size={16} /> นำเข้าข้อมูล
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              tabIndex={-1}
              aria-label="เลือกไฟล์สำรองข้อมูล"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </div>

          {pending && (
            <div className="import-confirm" role="alertdialog" aria-labelledby="import-title" aria-describedby="import-desc">
              <h3 id="import-title" className="settings-heading">
                ยืนยันการนำเข้า
              </h3>
              <p id="import-desc" className="settings-help">
                ไฟล์นี้มีงาน {pending.data.tasks.length} รายการ บันทึก {pending.data.notes.length} รายการ
                {pending.data.expenses ? ` รายรับรายจ่าย ${pending.data.expenses.length} รายการ` : ""}
                {pending.data.toolData ? ` ข้อมูลเครื่องมืออื่น ${Object.keys(pending.data.toolData).length} ชุด` : ""}
                {pending.data.settings ? " การตั้งค่า" : ""}
                {pending.data.layout ? " และ Dashboard" : ""}
                {pending.exportedAt ? ` (สำรองเมื่อ ${formatDateTime(new Date(pending.exportedAt).getTime(), dateTime)})` : ""}
                {pending.skipped > 0 ? ` · ข้ามข้อมูลที่ไม่ถูกต้อง ${pending.skipped} รายการ` : ""}
                <br />
                <strong>ข้อมูลปัจจุบันในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลจากไฟล์</strong> แนะนำให้สำรองข้อมูลปัจจุบันก่อน
              </p>
              <div className="button-row">
                <button type="button" className="btn" disabled={busy} onClick={exportData}>
                  สำรองข้อมูลปัจจุบันก่อน
                </button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={confirmImport}>
                  แทนที่ด้วยข้อมูลจากไฟล์
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setPending(null)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          <div className="settings-group danger-zone">
            <h3 className="settings-heading">ลบข้อมูลทั้งหมด</h3>
            <p className="settings-help">ลบงาน บันทึก บัญชีรายรับรายจ่าย ข้อมูลเครื่องมือทั้งหมด การตั้งค่า และ Dashboard ออกจากเบราว์เซอร์นี้</p>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={clearData}>
              <Trash2 aria-hidden="true" size={16} /> ลบข้อมูลทั้งหมด
            </button>
          </div>
        </section>

        {message && (
          <p className={`settings-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </div>
    </>
  );
}
