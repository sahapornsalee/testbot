# Roadmap

| ระยะ | เป้าหมาย | งานหลัก | เกณฑ์ผ่าน | สถานะ |
| --- | --- | --- | --- | --- |
| Phase 0 | Repository พร้อมพัฒนา | โครงสร้าง เอกสาร React/TS/Vite/ESLint/Vitest design tokens | ติดตั้ง รัน และ build ได้ | เสร็จ |
| Phase 1 | Core Dashboard | Layout Sidebar Search Favorites ธีม นาฬิกา เครื่องคิดเลข Timer | ใช้งานได้และผ่าน unit tests | เสร็จ |
| Phase 2 | Local Data และ Customization | Dashboard ลาก/ปรับขนาด/ซ่อน, IndexedDB, Notes, To-do, Import/Export | รีเฟรชแล้วข้อมูลยังอยู่ สำรองข้อมูลได้ | เสร็จ |
| Phase 3 | เครื่องมือเพิ่มเติม | ปฏิทิน แปลงหน่วย เปอร์เซ็นต์ JSON Markdown UUID ข้อความ ค้นหาตามหมวด | validation + tests ทุกเครื่องมือ | เสร็จ |
| Phase 4 | PWA และ Offline | Manifest service worker offline fallback การอัปเดต cache | ใช้งานออฟไลน์ได้จริง | เสร็จ (ทดสอบ E2E บน Chromium) |
| Phase 5 | QA Security Release | E2E, accessibility, dependency audit, CI/CD, rollback | ผ่านก่อนอนุมัติเผยแพร่ | เสร็จฝั่งโค้ด — รอผู้ใช้เปิด Pages (L4) |

## ไอเดียสำหรับเวอร์ชันถัดไป (ยังไม่อยู่ในขอบเขต)

- ภาษาอังกฤษ (i18n)
- แจ้งเตือนผ่าน Notification API เมื่อนับถอยหลังจบขณะแท็บอยู่เบื้องหลัง
- ซิงก์ข้ามอุปกรณ์ (ต้องมี backend — นอกขอบเขต local-first)
