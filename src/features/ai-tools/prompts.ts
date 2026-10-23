import { createId } from "../../data/db";
import { isRecord } from "../../lib/storage";

export const PROMPTS_KEY = "productivity-hub:prompts";
export const MAX_PROMPTS = 200;

export interface PromptTemplate {
  id: string;
  title: string;
  /** Text with {{ตัวแปร}} placeholders. */
  body: string;
}

export interface PromptsData {
  version: 1;
  prompts: PromptTemplate[];
}

export const DEFAULT_PROMPTS: PromptsData = {
  version: 1,
  prompts: [
    { id: "summary", title: "สรุปเอกสาร", body: "สรุปเนื้อหาต่อไปนี้เป็นข้อ ๆ ภาษาไทย ไม่เกิน {{จำนวนข้อ}} ข้อ เน้นประเด็นสำคัญและตัวเลข\n\n\"\"\"\n{{เนื้อหา}}\n\"\"\"" },
    { id: "email", title: "เขียนอีเมลสุภาพ", body: "ช่วยเขียนอีเมลภาษา{{ภาษา}} ถึง {{ผู้รับ}} เรื่อง {{เรื่อง}} น้ำเสียงสุภาพและกระชับ" },
    { id: "translate", title: "แปลภาษา", body: "แปลข้อความต่อไปนี้เป็นภาษา{{ภาษาปลายทาง}} ให้เป็นธรรมชาติ คงความหมายเดิม\n\n\"\"\"\n{{ข้อความ}}\n\"\"\"" },
    { id: "explain", title: "อธิบายให้เข้าใจง่าย", body: "อธิบายเรื่อง {{หัวข้อ}} ให้คนทั่วไปเข้าใจ ยกตัวอย่างประกอบ และสรุปท้ายเป็น 3 ข้อ" },
    { id: "proofread", title: "ตรวจคำผิด", body: "ตรวจคำผิดและไวยากรณ์ของข้อความต่อไปนี้ แสดงจุดที่แก้พร้อมเหตุผล แล้วให้ฉบับแก้ไขทั้งหมด\n\n\"\"\"\n{{ข้อความ}}\n\"\"\"" },
    { id: "excel", title: "สูตร Excel", body: "ช่วยเขียนสูตร Excel/Google Sheets เพื่อ {{สิ่งที่ต้องการ}} ข้อมูลอยู่ในคอลัมน์ {{คอลัมน์}} อธิบายสูตรทีละส่วน" },
  ],
};

export function parsePrompts(raw: unknown): PromptsData | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.prompts)) return null;
  const prompts: PromptTemplate[] = [];
  for (const p of raw.prompts.slice(0, MAX_PROMPTS)) {
    if (!isRecord(p) || typeof p.id !== "string" || typeof p.title !== "string" || typeof p.body !== "string") continue;
    if (!p.title.trim() || p.body.length > 20_000) continue;
    prompts.push({ id: p.id, title: p.title.slice(0, 100), body: p.body });
  }
  return { version: 1, prompts };
}

/** Unique placeholder names in order of appearance. */
export function placeholders(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1] as string))];
}

export function fillTemplate(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, name: string) => (values[name]?.trim() ? (values[name] as string) : whole));
}

export function createPrompt(title: string, body: string): PromptTemplate | null {
  if (!title.trim() || !body.trim()) return null;
  return { id: createId(), title: title.trim().slice(0, 100), body };
}
