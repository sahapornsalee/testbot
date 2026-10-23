import { useFavorites } from "../dashboard/FavoritesContext";
import { useSettings } from "./SettingsContext";
import type { ThemePreference, TimeFormat } from "./settings";
import "./settings.css";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "สว่าง" },
  { value: "dark", label: "มืด" },
  { value: "system", label: "ตามระบบ" },
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: "24h", label: "24 ชั่วโมง" },
  { value: "12h", label: "12 ชั่วโมง" },
];

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { resetFavorites } = useFavorites();

  return (
    <>
      <h1 className="page-title">ตั้งค่า</h1>
      <p className="page-subtitle">การตั้งค่าเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ได้ส่งออกนอกอุปกรณ์</p>

      <div className="card settings-card">
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

        <div className="settings-group">
          <h2 className="settings-heading">Dashboard</h2>
          <p className="settings-help">คืนค่ารายการเครื่องมือที่ปักหมุดกลับเป็นค่าเริ่มต้น</p>
          <button type="button" className="btn" onClick={resetFavorites}>
            คืนค่าการปักหมุดเริ่มต้น
          </button>
        </div>

        <div className="settings-group">
          <h2 className="settings-heading">ภาษา</h2>
          <p className="settings-help">ขณะนี้รองรับภาษาไทย ภาษาอื่นอยู่ในแผนพัฒนา</p>
        </div>
      </div>
    </>
  );
}
