import { PRESET_ZONES } from "../life/worldClock";

/** Friendly name for a time zone, e.g. "Asia/Bangkok" -> "กรุงเทพฯ". */
export function zoneDisplayName(zone: string): string {
  return PRESET_ZONES.find((p) => p.zone === zone)?.label ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}
