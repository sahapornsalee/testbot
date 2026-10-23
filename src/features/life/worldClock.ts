import { isRecord } from "../../lib/storage";

export const WORLD_CLOCK_KEY = "productivity-hub:world-clock";

export const PRESET_ZONES: { zone: string; label: string }[] = [
  { zone: "Asia/Bangkok", label: "กรุงเทพฯ" },
  { zone: "Asia/Tokyo", label: "โตเกียว" },
  { zone: "Asia/Seoul", label: "โซล" },
  { zone: "Asia/Shanghai", label: "เซี่ยงไฮ้ / ปักกิ่ง" },
  { zone: "Asia/Hong_Kong", label: "ฮ่องกง" },
  { zone: "Asia/Singapore", label: "สิงคโปร์" },
  { zone: "Asia/Kuala_Lumpur", label: "กัวลาลัมเปอร์" },
  { zone: "Asia/Jakarta", label: "จาการ์ตา" },
  { zone: "Asia/Ho_Chi_Minh", label: "โฮจิมินห์" },
  { zone: "Asia/Yangon", label: "ย่างกุ้ง" },
  { zone: "Asia/Kolkata", label: "อินเดีย" },
  { zone: "Asia/Dubai", label: "ดูไบ" },
  { zone: "Europe/London", label: "ลอนดอน" },
  { zone: "Europe/Paris", label: "ปารีส" },
  { zone: "Europe/Berlin", label: "เบอร์ลิน" },
  { zone: "Europe/Moscow", label: "มอสโก" },
  { zone: "America/New_York", label: "นิวยอร์ก" },
  { zone: "America/Chicago", label: "ชิคาโก" },
  { zone: "America/Los_Angeles", label: "ลอสแอนเจลิส" },
  { zone: "America/Sao_Paulo", label: "เซาเปาโล" },
  { zone: "Australia/Sydney", label: "ซิดนีย์" },
  { zone: "Pacific/Auckland", label: "โอ๊คแลนด์" },
  { zone: "UTC", label: "UTC" },
];

export interface WorldClockData {
  version: 1;
  zones: string[];
}

export const DEFAULT_WORLD_CLOCK: WorldClockData = { version: 1, zones: ["Asia/Tokyo", "Europe/London", "America/New_York"] };

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function parseWorldClock(raw: unknown): WorldClockData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.zones)) return null;
  const zones = [...new Set(raw.zones.filter((z): z is string => typeof z === "string" && isValidZone(z)))].slice(0, 20);
  return { version: 1, zones };
}

export function zoneLabel(zone: string): string {
  return PRESET_ZONES.find((p) => p.zone === zone)?.label ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

/** Offset of `zone` from UTC in minutes at instant `date`. */
export function zoneOffsetMinutes(zone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** e.g. "+2 ชม." / "−5 ชม. 30 นาที" / "เวลาเดียวกัน" relative to the device. */
export function describeDifference(minutes: number): string {
  if (minutes === 0) return "เวลาเดียวกับเครื่องนี้";
  const sign = minutes > 0 ? "เร็วกว่า" : "ช้ากว่า";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign} ${h > 0 ? `${h} ชม.` : ""}${h > 0 && m > 0 ? " " : ""}${m > 0 ? `${m} นาที` : ""}`;
}
