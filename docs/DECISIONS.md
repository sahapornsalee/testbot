# บันทึกการตัดสินใจ (ADR)

## ADR-001 — React + TypeScript + Vite, ไม่มี backend
ตามข้อกำหนด local-first และ deploy บน GitHub Pages ใช้ TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)

## ADR-002 — Hash routing แทน history routing
GitHub Pages ไม่มี server rewrite การใช้ `#/path` ทำให้รีเฟรชและลิงก์ตรงทำงานโดยไม่ต้องใช้ 404.html hack และไม่ต้องเพิ่ม dependency router

## ADR-003 — ไม่ใช้ `eval` ในเครื่องคิดเลข
เขียน recursive-descent parser เอง (`src/features/calculator/engine.ts`) ทำให้ควบคุม error ได้ชัดเจน (หารศูนย์, วงเล็บไม่ครบ) และไม่มีความเสี่ยงรันโค้ดจากผู้ใช้ `%` หมายถึงหาร 100 (เช่น `200 × 15%` = 30)

## ADR-004 — Timer คำนวณจาก timestamp
Stopwatch/Countdown เก็บเวลาเริ่ม/เวลาสิ้นสุด แล้วคำนวณจากนาฬิกาจริง แทนการนับ tick เพราะเบราว์เซอร์ลดความถี่ timer เมื่อแท็บอยู่เบื้องหลัง

## ADR-005 — Dependencies ที่เพิ่ม
- `lucide-react` — ไอคอนตามข้อกำหนด (tree-shaken เฉพาะไอคอนที่ใช้)
- Dev: `vitest`, `jsdom`, `@testing-library/*` — unit/component tests; `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks` — คุณภาพโค้ด
- TypeScript ตรึงที่ 5.9 เพราะ `typescript-eslint` ยังรองรับไม่ถึง TypeScript 7
- ยังไม่ติดตั้ง Playwright (รอ Phase 5) และไลบรารี drag-and-drop (รอ Phase 2)

## ADR-006 — Base path ตั้งได้ด้วย `BASE_PATH`
ค่าเริ่มต้น `/testbot/` ตามชื่อ repository ใน CI ใช้ชื่อ repository อัตโนมัติ
