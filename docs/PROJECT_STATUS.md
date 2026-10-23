# Project Status

อัปเดตล่าสุด: 2026-10-23 · เวอร์ชัน 0.1.0 · ระยะปัจจุบัน: จบ Phase 1

## งาน

| Task | เป้าหมาย | Risk | Role | สถานะ |
| --- | --- | --- | --- | --- |
| TASK-001 | Bootstrap: React + TS + Vite, ESLint, Vitest, เอกสารควบคุม, workflow, base path | L2 | Orchestrator | DONE |
| TASK-002 | Dashboard UI, Theme, Search, Widget Registry, Favorites, responsive shell | L2 | UI | DONE |
| TASK-003 | นาฬิกา เครื่องคิดเลข Timer พร้อม unit tests | L1 | Feature | DONE |
| TASK-004 | เปิด GitHub Pages และ deploy ครั้งแรก | L4 | Release | BLOCKED — รอผู้ใช้เปิด Settings → Pages → GitHub Actions และ merge เข้า main |
| TASK-005 | Dashboard แบบปรับแต่งได้: ย้าย (คีย์บอร์ด + ลาก), ปรับขนาด, ซ่อน, คืนค่า layout | L2 | UI/Data | BACKLOG |
| TASK-006 | ชั้นข้อมูล IndexedDB + schema version + Import/Export JSON | L2 | Data | BACKLOG |
| TASK-007 | To-do List และ Notes | L1 | Feature | BACKLOG |

## ผลการตรวจสอบล่าสุด (รันจริง)

- `npm run lint` — ผ่าน
- `npm run typecheck` — ผ่าน
- `npm run test` — 12 ไฟล์, 74 tests ผ่าน
- `npm run build` — ผ่าน (เครื่องมือแต่ละตัวแยก chunk แบบ lazy)
- ตรวจด้วย Chromium (Playwright) ที่ 1280×860 และ 390×844 ธีมสว่าง/มืด ผ่าน `vite preview` ไม่พบ console error

## ปัญหาที่ทราบ / ข้อจำกัด

- สถานะ Stopwatch/Countdown ไม่ถูกบันทึก หากปิดหน้าหรือเปลี่ยนจาก Dashboard ไปหน้าเต็มของเครื่องมือ ค่าจะเริ่มใหม่
- ผลคำนวณที่แสดงแบบเลขยกกำลัง (เช่น `1e+20`) ใช้คำนวณต่อไม่ได้ ต้องพิมพ์ค่าใหม่
- รองรับเฉพาะภาษาไทย (FR-011 ส่วนภาษา ยังไม่ทำ)
- Dashboard ยังจัดลำดับ/ปรับขนาดเองไม่ได้ (Phase 2)
- ยังไม่มี E2E tests ด้วย Playwright (Phase 5)
- ยังไม่ได้ deploy จริง จึงยังไม่ได้ตรวจ URL ที่เผยแพร่
