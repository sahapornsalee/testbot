/** Unit conversion. Linear units convert through a base unit factor. */

export interface Unit {
  id: string;
  label: string;
  /** Multiply by this to get the base unit (ignored for temperature). */
  factor: number;
}

export interface UnitCategory {
  id: string;
  label: string;
  units: Unit[];
}

export const CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    label: "ความยาว",
    units: [
      { id: "mm", label: "มิลลิเมตร (mm)", factor: 0.001 },
      { id: "cm", label: "เซนติเมตร (cm)", factor: 0.01 },
      { id: "m", label: "เมตร (m)", factor: 1 },
      { id: "km", label: "กิโลเมตร (km)", factor: 1000 },
      { id: "in", label: "นิ้ว (in)", factor: 0.0254 },
      { id: "ft", label: "ฟุต (ft)", factor: 0.3048 },
      { id: "yd", label: "หลา (yd)", factor: 0.9144 },
      { id: "mi", label: "ไมล์ (mi)", factor: 1609.344 },
      { id: "wa", label: "วา", factor: 2 },
    ],
  },
  {
    id: "mass",
    label: "น้ำหนัก",
    units: [
      { id: "mg", label: "มิลลิกรัม (mg)", factor: 0.000001 },
      { id: "g", label: "กรัม (g)", factor: 0.001 },
      { id: "kg", label: "กิโลกรัม (kg)", factor: 1 },
      { id: "t", label: "ตัน (t)", factor: 1000 },
      { id: "oz", label: "ออนซ์ (oz)", factor: 0.028349523125 },
      { id: "lb", label: "ปอนด์ (lb)", factor: 0.45359237 },
      { id: "baht-gold", label: "บาท (ทองคำ)", factor: 0.0152 },
    ],
  },
  {
    id: "temperature",
    label: "อุณหภูมิ",
    units: [
      { id: "c", label: "เซลเซียส (°C)", factor: 1 },
      { id: "f", label: "ฟาเรนไฮต์ (°F)", factor: 1 },
      { id: "k", label: "เคลวิน (K)", factor: 1 },
    ],
  },
  {
    id: "area",
    label: "พื้นที่",
    units: [
      { id: "m2", label: "ตารางเมตร (m²)", factor: 1 },
      { id: "km2", label: "ตารางกิโลเมตร (km²)", factor: 1_000_000 },
      { id: "sqwa", label: "ตารางวา", factor: 4 },
      { id: "ngan", label: "งาน", factor: 400 },
      { id: "rai", label: "ไร่", factor: 1600 },
      { id: "ha", label: "เฮกตาร์ (ha)", factor: 10_000 },
      { id: "acre", label: "เอเคอร์", factor: 4046.8564224 },
      { id: "ft2", label: "ตารางฟุต (ft²)", factor: 0.09290304 },
    ],
  },
  {
    id: "volume",
    label: "ปริมาตร",
    units: [
      { id: "ml", label: "มิลลิลิตร (ml)", factor: 0.001 },
      { id: "l", label: "ลิตร (l)", factor: 1 },
      { id: "m3", label: "ลูกบาศก์เมตร (m³)", factor: 1000 },
      { id: "gal", label: "แกลลอน US (gal)", factor: 3.785411784 },
      { id: "cup", label: "ถ้วยตวง US", factor: 0.2365882365 },
      { id: "tbsp", label: "ช้อนโต๊ะ", factor: 0.01478676478125 },
      { id: "tsp", label: "ช้อนชา", factor: 0.00492892159375 },
    ],
  },
  {
    id: "speed",
    label: "ความเร็ว",
    units: [
      { id: "mps", label: "เมตร/วินาที", factor: 1 },
      { id: "kmh", label: "กิโลเมตร/ชั่วโมง", factor: 1000 / 3600 },
      { id: "mph", label: "ไมล์/ชั่วโมง", factor: 1609.344 / 3600 },
      { id: "knot", label: "นอต", factor: 1852 / 3600 },
    ],
  },
  {
    id: "data",
    label: "ข้อมูลดิจิทัล",
    units: [
      { id: "b", label: "ไบต์ (B)", factor: 1 },
      { id: "kb", label: "กิโลไบต์ (KB)", factor: 1000 },
      { id: "mb", label: "เมกะไบต์ (MB)", factor: 1e6 },
      { id: "gb", label: "กิกะไบต์ (GB)", factor: 1e9 },
      { id: "tb", label: "เทราไบต์ (TB)", factor: 1e12 },
      { id: "kib", label: "กิบิไบต์ (KiB)", factor: 1024 },
      { id: "mib", label: "เมบิไบต์ (MiB)", factor: 1024 ** 2 },
      { id: "gib", label: "กิบิไบต์ (GiB)", factor: 1024 ** 3 },
    ],
  },
  {
    id: "time",
    label: "เวลา",
    units: [
      { id: "ms", label: "มิลลิวินาที", factor: 0.001 },
      { id: "s", label: "วินาที", factor: 1 },
      { id: "min", label: "นาที", factor: 60 },
      { id: "h", label: "ชั่วโมง", factor: 3600 },
      { id: "day", label: "วัน", factor: 86_400 },
      { id: "week", label: "สัปดาห์", factor: 604_800 },
      { id: "year", label: "ปี (365 วัน)", factor: 31_536_000 },
    ],
  },
];

function toCelsius(value: number, unit: string): number {
  if (unit === "f") return ((value - 32) * 5) / 9;
  if (unit === "k") return value - 273.15;
  return value;
}

function fromCelsius(value: number, unit: string): number {
  if (unit === "f") return (value * 9) / 5 + 32;
  if (unit === "k") return value + 273.15;
  return value;
}

export type ConversionResult = { ok: true; value: number } | { ok: false; error: string };

export function convert(value: number, categoryId: string, fromId: string, toId: string): ConversionResult {
  if (!Number.isFinite(value)) return { ok: false, error: "กรุณาใส่ตัวเลข" };
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const from = category?.units.find((u) => u.id === fromId);
  const to = category?.units.find((u) => u.id === toId);
  if (!category || !from || !to) return { ok: false, error: "หน่วยไม่ถูกต้อง" };
  if (category.id === "temperature") {
    const celsius = toCelsius(value, from.id);
    if (celsius < -273.15 - 1e-9) return { ok: false, error: "ต่ำกว่าศูนย์สัมบูรณ์ (−273.15 °C)" };
    return { ok: true, value: round(fromCelsius(celsius, to.id)) };
  }
  if (value < 0 && category.id !== "time") return { ok: false, error: "ค่าต้องไม่ติดลบ" };
  return { ok: true, value: round((value * from.factor) / to.factor) };
}

export function round(value: number): number {
  const rounded = Number(value.toPrecision(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatNumber(value: number): string {
  if (value !== 0 && (Math.abs(value) >= 1e15 || Math.abs(value) < 1e-6)) return value.toExponential(6);
  return value.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/** Parses user input, allowing thousands separators. */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/,/g, "").trim();
  if (cleaned === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}
