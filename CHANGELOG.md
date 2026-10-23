# Changelog

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
