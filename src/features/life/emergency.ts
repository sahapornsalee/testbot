import { isRecord } from "../../lib/storage";

export const EMERGENCY_KEY = "productivity-hub:emergency";

/** Thai national emergency and help numbers (free to call). */
export const EMERGENCY_NUMBERS = [
  { number: "191", label: "แจ้งเหตุด่วนเหตุร้าย (ตำรวจ)" },
  { number: "1669", label: "เจ็บป่วยฉุกเฉิน / รถพยาบาล (สพฉ.)" },
  { number: "199", label: "แจ้งเหตุไฟไหม้ ดับเพลิง" },
  { number: "1155", label: "ตำรวจท่องเที่ยว" },
  { number: "1193", label: "ตำรวจทางหลวง" },
  { number: "1784", label: "ศูนย์ป้องกันและบรรเทาสาธารณภัย" },
  { number: "1367", label: "ศูนย์พิษวิทยา (สารพิษ งูกัด)" },
  { number: "1323", label: "สายด่วนสุขภาพจิต" },
  { number: "1300", label: "ศูนย์ช่วยเหลือสังคม (ความรุนแรง คนหาย)" },
  { number: "1199", label: "เหตุด่วนทางน้ำ" },
] as const;

export interface MedicalInfo {
  version: 1;
  name: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  contactName: string;
  contactPhone: string;
}

export const EMPTY_MEDICAL: MedicalInfo = { version: 1, name: "", bloodType: "", allergies: "", conditions: "", medications: "", contactName: "", contactPhone: "" };

export const MEDICAL_FIELDS = ["name", "bloodType", "allergies", "conditions", "medications", "contactName", "contactPhone"] as const;

export function parseMedical(raw: unknown): MedicalInfo | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const info: MedicalInfo = { ...EMPTY_MEDICAL };
  for (const key of MEDICAL_FIELDS) {
    const value = raw[key];
    if (typeof value === "string") info[key] = value.slice(0, 500);
  }
  return info;
}

/** Keeps digits, +, and separators so tel: links stay valid. */
export function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{3,15}$/.test(cleaned) ? `tel:${cleaned}` : null;
}
