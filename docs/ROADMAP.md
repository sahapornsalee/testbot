# Roadmap

แต่ละระยะต้องผ่านเกณฑ์ก่อนเริ่มระยะถัดไป ระยะเหล่านี้เป็นลำดับความสำคัญ ไม่ใช่การรับประกันระยะเวลา

| ระยะ | เป้าหมาย | งานหลัก | เกณฑ์ผ่าน | สถานะ |
| --- | --- | --- | --- | --- |
| Phase 0 | Repository พร้อมพัฒนา | โครงสร้างไฟล์ เอกสารควบคุม AI, React/TS/Vite/ESLint/Vitest, design tokens | ติดตั้ง รัน dev server และ build ได้ | เสร็จ |
| Phase 1 | Core Dashboard | Layout, Sidebar, Search, Favorites, ธีม, นาฬิกา เครื่องคิดเลข Timer, responsive navigation | เครื่องมือหลักใช้งานได้และผ่าน unit tests | เสร็จ |
| Phase 2 | Local Data และ Customization | Dashboard drag/resize/ซ่อนวิดเจ็ต, IndexedDB, Notes, To-do, Import/Export | รีเฟรชแล้วข้อมูลยังอยู่ และสำรองข้อมูลได้ | ถัดไป |
| Phase 3 | เครื่องมือเพิ่มเติม | ปฏิทินและคำนวณวัน, แปลงหน่วย/เปอร์เซ็นต์, JSON/Markdown/UUID | ทุกเครื่องมือมี validation และ tests | รอ |
| Phase 4 | PWA และ Offline | Manifest, service worker, offline fallback, อัปเดต cache | ติดตั้งและใช้งานออฟไลน์ได้จริง | รอ |
| Phase 5 | QA, Security, Release | E2E (Playwright), accessibility review, dependency audit, deploy จริง, rollback | build/tests/deploy/privacy ผ่านก่อนอนุมัติ | รอ |
