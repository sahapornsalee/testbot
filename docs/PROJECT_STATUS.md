# Project Status

อัปเดตล่าสุด: 2026-10-23 · เวอร์ชัน 1.3.0 · เผยแพร่แล้วที่ https://sahapornsalee.github.io/testbot/

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
| TASK-004 | เปิด GitHub Pages และ deploy จริง | L4 | DONE (ผู้ใช้เปิด Pages และ merge PR #3) |
| TASK-012 | Dashboard การ์ดสูงเท่ากันและแถวเต็ม | L1 | DONE (PR #4) |
| TASK-013 | เครื่องมือออฟไลน์ 20 ตัว + IndexedDB v2 + backup ขยาย | L2 | DONE (PR #5) |
| TASK-014 | วันเวลาแบบไทยเป็นค่าเริ่มต้น ตั้งเป็นอังกฤษได้ | L2 | DONE (PR #6) |
| TASK-015 | แปลงรูปเป็นข้อความให้ AI (OCR ออฟไลน์) | L2 | REVIEW — รอ merge |

## ผลการตรวจสอบล่าสุด (รันจริงในเครื่องพัฒนา)

หลังติดตั้งใหม่ด้วย `npm ci`:

- `npm run lint` — ผ่าน
- `npm run typecheck` — ผ่าน
- `npm run test` — 22 ไฟล์, 141 tests ผ่าน
- `npm run build` — ผ่าน (12 เครื่องมือแยก chunk แบบ lazy + `sw.js`)
- `npm run test:e2e` — 24 ผ่าน, 2 ข้ามโดยตั้งใจ (ลากวางและคีย์บอร์ดบนโปรไฟล์มือถือ); รันซ้ำ 3 รอบ 72/72 ผ่าน ไม่มี flaky
- `npm audit` — 0 vulnerabilities

## ปัญหาที่ทราบ / ข้อจำกัด

- OCR: ตัวหนังสือสีอ่อนบนพื้นเข้ม ลายมือ หรือตัวเล็กมาก อาจอ่านไม่ออก; ใช้ OCR ครั้งแรกต้องออนไลน์ (ดาวน์โหลด ~4–8 MB)
- AI เข้าใจรูปจากข้อความได้จำกัด เหมาะกับเอกสาร/ภาพหน้าจอที่มีตัวหนังสือ มากกว่าภาพถ่ายทั่วไป

- ข้อความในแอปเป็นภาษาไทยเท่านั้น (รูปแบบวันที่เลือกไทย/อังกฤษ UK ได้)
- นับถอยหลัง: เสียงเตือนดังเฉพาะเมื่อหน้าเปิดอยู่ ถ้าปิดแท็บไปแล้วจะเห็นสถานะ “หมดเวลาแล้ว” เมื่อกลับมา (ไม่มี push notification ตามขอบเขต)
- Drag-and-drop ใช้ได้กับเมาส์ บนจอสัมผัส/คีย์บอร์ดใช้ปุ่ม ↑↓ แทน
- E2E และ offline ทดสอบบน Chromium เท่านั้น ยังไม่ได้ทดสอบ Safari/Firefox จริง
- ยังไม่ได้ทดสอบกับ screen reader จริง (ตรวจ accessible name/role ผ่าน tests)
- ผมไม่สามารถเปิด URL ที่เผยแพร่จากเครื่องพัฒนาได้ (เครือข่ายถูกจำกัด) ผู้ใช้ยืนยันด้วยภาพหน้าจอว่าเว็บขึ้นแล้ว
- เบอร์ฉุกเฉินเป็นข้อมูลคงที่ในโค้ด ควรตรวจทานเป็นระยะ
