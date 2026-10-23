# Changelog

## [1.0.0] — 2026-10-23

### Added
- Dashboard ปรับแต่งได้: ลากวาง + ปุ่มลูกศร (คีย์บอร์ด/สัมผัส), ปรับขนาด, ซ่อน, เพิ่ม/นำออก, เลือกจำนวนคอลัมน์, คืนค่าเริ่มต้น, มือถือเป็น 1 คอลัมน์อัตโนมัติ
- ชั้นข้อมูล IndexedDB (ไม่มี dependency) พร้อม validation ทุก record
- รายการงาน (To-do) และบันทึก (autosave)
- ปฏิทินและคำนวณวัน, แปลงหน่วย, คำนวณเปอร์เซ็นต์
- JSON Formatter, Markdown Preview (renderer ปลอดภัย), UUID Generator, เครื่องมือข้อความ
- สำรอง/นำเข้า/ลบข้อมูลทั้งหมด พร้อมตรวจขนาด ชนิด เวอร์ชัน และโครงสร้างไฟล์
- PWA: manifest, ไอคอน, service worker ที่สร้างรายการ precache ตอน build, แจ้งเวอร์ชันใหม่, แจ้งสถานะออฟไลน์
- E2E tests ด้วย Playwright (desktop + mobile) และรันใน CI ก่อน deploy

### Changed
- Favorites ของ 0.1.0 ถูกย้ายไปเป็น Dashboard layout อัตโนมัติ (`productivity-hub:favorites` → `productivity-hub:layout`)
- Stopwatch/นับถอยหลัง บันทึกสถานะ จึงเดินต่อหลังรีเฟรชหรือเปลี่ยนหน้า
- เครื่องคิดเลขรับเลขยกกำลัง (เช่น `1e+20`) จึงใช้ผลลัพธ์ขนาดใหญ่คำนวณต่อได้

### Fixed
- Skip link ไม่พาไปหน้า “ไม่พบหน้านี้” อีก (ขัดกับ hash routing)

## [0.1.0] — 2026-10-23

### Added
- โครงโปรเจกต์ React 19 + TypeScript (strict) + Vite, ESLint, Vitest + Testing Library
- GitHub Actions: lint, test, build ทุก PR และ deploy GitHub Pages จาก `main`
- เอกสารควบคุมงาน: AGENTS.md, REQUIREMENTS, ARCHITECTURE, ROADMAP, PROJECT_STATUS, DECISIONS, TEST_PLAN, SECURITY
- App shell แบบ responsive: header, sidebar (drawer บนมือถือ), skip link, hash routing
- Widget Registry พร้อม lazy loading และ ErrorBoundary ต่อวิดเจ็ต
- Dashboard พร้อมระบบปักหมุด (Favorites) และ empty state
- ค้นหาเครื่องมือจากชื่อ คำอธิบาย หมวดหมู่ และ keyword
- ธีมสว่าง/มืด/ตามระบบ และรูปแบบเวลา 12/24 ชั่วโมง เก็บใน LocalStorage พร้อม validation
- นาฬิกา, เครื่องคิดเลข (parser ปลอดภัย ไม่ใช้ eval), จับเวลา/นับถอยหลัง
