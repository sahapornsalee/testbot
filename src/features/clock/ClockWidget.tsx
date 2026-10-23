import { useNow } from "../../hooks/useNow";
import { useSettings } from "../settings/SettingsContext";
import { deviceTimeZone, formatLongDate, formatTime, formatUtcOffset } from "./clock";
import "./clock.css";

export default function ClockWidget() {
  const now = new Date(useNow(1000));
  const { settings } = useSettings();

  return (
    <div className="clock">
      <time className="clock-time" dateTime={now.toISOString()}>
        {formatTime(now, settings.timeFormat)}
      </time>
      <p className="clock-date">{formatLongDate(now)}</p>
      <p className="clock-zone">
        {deviceTimeZone()} · {formatUtcOffset(-now.getTimezoneOffset())}
      </p>
    </div>
  );
}
