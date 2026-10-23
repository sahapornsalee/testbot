# Project Status

อัปเดตล่าสุด: 2026-10-23 · เวอร์ชัน 1.0.0 · ระยะปัจจุบัน: พร้อมเผยแพร่ (รอผู้ใช้อนุมัติ L4)

## งาน

| Task | เป้าหมาย | Risk | สถานะ |
| --- | --- | --- | --- |
| TASK-001 | Bootstrap โปรเจกต์ เอกสาร CI | L2 | DONE |
| TASK-002 | Dashboard UI ธีม ค้นหา Widget Registry | L2 | DONE |
| TASK-003 | นาฬิกา เครื่องคิดเลข Timer | L1 | DONE |
| TASK-005 | Dashboard ปรับแต่งได้ + migration จาก favorites | L2 | DONE |
| TASK-006 | IndexedDB + Import/Export + ลบข้อมูล | L2/L3 | DONE |
| TASK-007 | To-do และ Notes | L1 | DONE |
| TASK-008 | ปฏิทิน แปลงหน่วย เปอร์เซ็นต์ | L1 | DONE |
| TASK-009 | JSON Markdown UUID ข้อความ | L1 | DONE |
| TASK-010 | PWA offline update flow | L2 | DONE |
| TASK-011 | E2E tests + CI gate ก่อน deploy | L2 | DONE |
| TASK-004 | เปิด GitHub Pages และ deploy จริง | L4 | BLOCKED — รอผู้ใช้ merge เข้า main และตั้ง Settings → Pages → Source: GitHub Actions |

## ผลการตรวจสอบล่าสุด (รันจริงในเครื่องพัฒนา)

หลังติดตั้งใหม่ด้วย `npm ci`:

- `npm run lint` — ผ่าน
- `npm run typecheck` — ผ่าน
- `npm run test` — 22 ไฟล์, 141 tests ผ่าน
- `npm run build` — ผ่าน (12 เครื่องมือแยก chunk แบบ lazy + `sw.js`)
- `npm run test:e2e` — 24 ผ่าน, 2 ข้ามโดยตั้งใจ (ลากวางและคีย์บอร์ดบนโปรไฟล์มือถือ); รันซ้ำ 3 รอบ 72/72 ผ่าน ไม่มี flaky
- `npm audit` — 0 vulnerabilities

## ปัญหาที่ทราบ / ข้อจำกัด

- รองรับเฉพาะภาษาไทย
- นับถอยหลัง: เสียงเตือนดังเฉพาะเมื่อหน้าเปิดอยู่ ถ้าปิดแท็บไปแล้วจะเห็นสถานะ “หมดเวลาแล้ว” เมื่อกลับมา (ไม่มี push notification ตามขอบเขต)
- Drag-and-drop ใช้ได้กับเมาส์ บนจอสัมผัส/คีย์บอร์ดใช้ปุ่ม ↑↓ แทน
- E2E และ offline ทดสอบบน Chromium เท่านั้น ยังไม่ได้ทดสอบ Safari/Firefox จริง
- ยังไม่ได้ทดสอบกับ screen reader จริง (ตรวจ accessible name/role ผ่าน tests)
- ยังไม่ได้ deploy จริง จึงยังไม่ได้ตรวจ URL ที่เผยแพร่
