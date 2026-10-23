import { useState } from "react";
import { X } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useSettings } from "../settings/SettingsContext";
import { DEFAULT_WORLD_CLOCK, describeDifference, parseWorldClock, PRESET_ZONES, WORLD_CLOCK_KEY, zoneLabel, zoneOffsetMinutes } from "./worldClock";
import "./life.css";

export default function WorldClockWidget() {
  const [data, setData] = usePersistentState(WORLD_CLOCK_KEY, parseWorldClock, DEFAULT_WORLD_CLOCK);
  const { settings } = useSettings();
  const now = new Date(useNow(1000));
  const [choice, setChoice] = useState("");
  const localOffset = -now.getTimezoneOffset();
  const available = PRESET_ZONES.filter((p) => !data.zones.includes(p.zone));

  return (
    <div className="stack">
      <ul className="zone-list" aria-label="เวลาในเมืองต่าง ๆ">
        {data.zones.map((zone) => {
          const diff = zoneOffsetMinutes(zone, now) - localOffset;
          return (
            <li key={zone} className="zone-item">
              <div>
                {zoneLabel(zone)}
                <small>
                  {new Intl.DateTimeFormat("th-TH", { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).format(now)} · {describeDifference(diff)}
                </small>
              </div>
              <span className="zone-time">
                {new Intl.DateTimeFormat("th-TH", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: settings.timeFormat === "12h" }).format(now)}
              </span>
              <button type="button" className="icon-btn small-btn danger" aria-label={`นำ ${zoneLabel(zone)} ออก`} onClick={() => setData((d) => ({ ...d, zones: d.zones.filter((z) => z !== zone) }))}>
                <X aria-hidden="true" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="tasks-add">
        <select className="input" aria-label="เลือกเมือง" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">เลือกเมืองที่จะเพิ่ม…</option>
          {available.map((p) => (
            <option key={p.zone} value={p.zone}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!choice || data.zones.length >= 20}
          onClick={() => {
            setData((d) => ({ ...d, zones: [...d.zones, choice] }));
            setChoice("");
          }}
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}
