import { DEFAULT_TIME_ZONE, isValidZone, type DateLocale } from "../../lib/datetime";
import { isRecord } from "../../lib/storage";

export type ThemePreference = "light" | "dark" | "system";
export type TimeFormat = "24h" | "12h";

export interface Settings {
  version: 1;
  theme: ThemePreference;
  timeFormat: TimeFormat;
  /** Date format and calendar era: Thai (พ.ศ.) or English UK. */
  dateLocale: DateLocale;
  /** IANA zone used for clocks and "today"; "device" follows the device. */
  timeZone: string;
}

export const DEVICE_ZONE = "device";

export const SETTINGS_KEY = "productivity-hub:settings";

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  timeFormat: "24h",
  dateLocale: "th",
  timeZone: DEFAULT_TIME_ZONE,
};

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];
const TIME_FORMATS: readonly TimeFormat[] = ["24h", "12h"];

/** Validates persisted settings; unknown or invalid fields fall back to defaults. */
export function parseSettings(raw: unknown): Settings | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  return {
    version: 1,
    theme: THEMES.includes(raw.theme as ThemePreference)
      ? (raw.theme as ThemePreference)
      : DEFAULT_SETTINGS.theme,
    timeFormat: TIME_FORMATS.includes(raw.timeFormat as TimeFormat)
      ? (raw.timeFormat as TimeFormat)
      : DEFAULT_SETTINGS.timeFormat,
    dateLocale: raw.dateLocale === "en-GB" ? "en-GB" : "th",
    timeZone:
      typeof raw.timeZone === "string" && (raw.timeZone === DEVICE_ZONE || isValidZone(raw.timeZone))
        ? raw.timeZone
        : DEFAULT_TIME_ZONE,
  };
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): "light" | "dark" {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}
