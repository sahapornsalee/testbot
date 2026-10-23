import { useNow } from "../../hooks/useNow";
import { formatLongDate, formatTime, formatUtcOffset, zoneOffsetMinutes } from "../../lib/datetime";
import { useDateTime, useSettings } from "../settings/SettingsContext";
import { zoneDisplayName } from "./clock";
import "./clock.css";

export default function ClockWidget() {
  const now = new Date(useNow(1000));
  const { settings } = useSettings();
  const dateTime = useDateTime();

  return (
    <div className="clock">
      <time className="clock-time" dateTime={now.toISOString()}>
        {formatTime(now, dateTime, settings.timeFormat === "12h")}
      </time>
      <p className="clock-date">{formatLongDate(now, dateTime)}</p>
      <p className="clock-zone">
        {zoneDisplayName(dateTime.timeZone)} · {formatUtcOffset(zoneOffsetMinutes(dateTime.timeZone, now))}
      </p>
    </div>
  );
}
