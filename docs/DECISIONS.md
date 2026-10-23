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

## ADR-007 — IndexedDB แบบไม่มี dependency
ใช้ API ของเบราว์เซอร์ตรง ๆ ผ่าน wrapper เล็ก ๆ (`src/data/db.ts`) แทน Dexie/idb เพื่อลด dependency; ทดสอบด้วย `fake-indexeddb` (dev only)

## ADR-008 — Favorites รวมเข้ากับ Dashboard layout
“ปักหมุด” = อยู่บน Dashboard ส่วน “ซ่อน” = อยู่ใน layout แต่ไม่แสดง ข้อมูล v0.1.0 ถูก migrate อัตโนมัติ

## ADR-009 — จำนวนคอลัมน์คำนวณด้วย JS
ใช้ ResizeObserver คำนวณคอลัมน์และจำกัด span ไม่ให้เกินจำนวนคอลัมน์ เพราะ CSS grid `span N` ที่มากกว่าจำนวนคอลัมน์จะสร้างคอลัมน์เกินและล้นจอบนมือถือ

## ADR-010 — Markdown renderer เขียนเอง
แปลง Markdown เป็น React elements โดยตรง (ไม่ใช้ `dangerouslySetInnerHTML`) HTML ในเนื้อหาแสดงเป็นข้อความ ลิงก์อนุญาตเฉพาะ http/https/mailto รองรับ syntax พื้นฐาน (ไม่มีตาราง)

## ADR-011 — Service worker เขียนเอง + สร้างรายการ precache ตอน build
แทน Workbox เพื่อลด dependency; plugin ใน `vite.config.ts` รู้รายการไฟล์จริงของ build การอัปเดตต้องให้ผู้ใช้กดยืนยัน และไม่ reload อัตโนมัติในการเข้าใช้ครั้งแรก

## ADR-012 — Import แบบแทนที่ทั้งหมด
การรวมข้อมูล (merge) ทำให้เกิดข้อมูลซ้ำ/ขัดกันได้ง่าย จึงเลือกแทนที่ทั้งหมดพร้อมปุ่ม “สำรองข้อมูลปัจจุบันก่อน” และสรุปจำนวนรายการก่อนยืนยัน

## ADR-013 — Dependencies เพิ่มเติม (dev only)
`fake-indexeddb` สำหรับ unit tests, `@playwright/test` สำหรับ E2E ไม่มี runtime dependency เพิ่ม (runtime ยังมีเพียง react, react-dom, lucide-react)

## ADR-014 — ใช้ `qrcode-generator` สำหรับ QR Code
การเข้ารหัส QR (Reed–Solomon, mask, version 1–40) ซับซ้อนและผิดพลาดง่ายถ้าเขียนเอง ไลบรารีนี้ใช้ MIT ไม่มี dependency ต่อ ~25 KB และโหลดแบบ lazy เฉพาะหน้า QR เราแปลงข้อความเป็น UTF-8 เองก่อนส่งเข้าไลบรารี และวาดเป็น SVG ด้วย React (ไม่ใช้ HTML string จากไลบรารี)

## ADR-015 — IndexedDB v2 เพิ่ม store `expenses`
รายรับรายจ่ายโตได้เรื่อย ๆ จึงเก็บใน IndexedDB การอัปเกรดสร้างเฉพาะ store ที่ขาด ข้อมูล v1 อยู่ครบ (มี unit test ยืนยัน)

## ADR-016 — ข้อมูลเครื่องมือขนาดเล็กเก็บใน LocalStorage แบบมี version
นิสัย วันสำคัญ ตัวนับ ฯลฯ มีขนาดเล็กและอ่านพร้อมกันทั้งชุด จึงใช้ `usePersistentState` + parser ต่อเครื่องมือ และลงทะเบียนใน `TOOL_STORES` เพื่อให้สำรอง/นำเข้า/ลบได้ครบ

## ADR-017 — ตัวสุ่มใช้ `crypto.getRandomValues`
รหัสผ่านและการสุ่มทั้งหมดใช้ตัวสุ่มที่ปลอดภัยพร้อม rejection sampling เพื่อไม่ให้เกิด modulo bias

## ADR-018 — วันเวลาตามการตั้งค่าแอป ไม่ตามอุปกรณ์
ผู้ใช้ต้องการให้เป็นแบบไทยเสมอแม้เครื่องตั้งภาษา/เขตเวลาอื่น จึงเพิ่ม `dateLocale` และ `timeZone` ในการตั้งค่า (ค่าเริ่มต้นไทย) และเลิกใช้ `<input type="date">` เพราะรูปแบบของมันผูกกับภาษาของเบราว์เซอร์และเปลี่ยนจากโค้ดไม่ได้ ข้อความในแอปยังเป็นภาษาไทย (ยังไม่ได้แปลทั้งแอป)
