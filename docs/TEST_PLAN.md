# แผนการทดสอบ

## คำสั่ง

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## Test matrix

| กลุ่ม | สิ่งที่ตรวจ | อยู่ที่ |
| --- | --- | --- |
| Unit | คำนวณ วันเวลา validation storage router search | `src/**/*.test.ts` |
| Component/Integration | Dashboard + storage, search, ธีม, เครื่องคิดเลข, timer | `src/**/*.test.tsx` |
| E2E | เปิดเว็บถึงบันทึกงาน | ยังไม่มี (Phase 5, Playwright) |
| Responsive | Desktop, Tablet, Mobile | ตรวจด้วยมือ/ภาพหน้าจอ |
| Security/Privacy | import, storage, external requests | ดู SECURITY.md |

## Checklist ที่ห้ามข้าม

สถานะ: ✅ มี automated test · 👀 ตรวจด้วยมือแล้ว · ⏳ ยังไม่ถึงระยะ

**Dashboard**
- ⏳ เพิ่มวิดเจ็ตแล้วย้ายตำแหน่งได้ (Phase 2)
- ⏳ เปลี่ยนขนาดและซ่อนวิดเจ็ตได้ (Phase 2)
- ✅ รีเฟรชแล้วการปักหมุดยังอยู่ (`App.test.tsx`)
- ✅ ข้อมูลผิดรูปแบบแล้วกลับสู่ค่าเริ่มต้น (`App.test.tsx`, `favorites.test.ts`)

**Calculator และ Timer**
- ✅ เลขติดลบ ทศนิยม เปอร์เซ็นต์ (`engine.test.ts`)
- ✅ ป้องกันการหารด้วยศูนย์และค่าไม่ถูกต้อง (`engine.test.ts`, `CalculatorWidget.test.tsx`)
- ✅ จับเวลา หยุด เริ่มใหม่ (`timer.test.ts`, `TimerWidget.test.tsx`)
- ✅ แท็บอยู่เบื้องหลังเป็นเวลานาน (`timer.test.ts`, `TimerWidget.test.tsx`)

**Local Data**
- ⏳ สร้าง แก้ไข ลบงาน (Phase 2)
- ⏳ ส่งออกและนำเข้าข้อมูล / ปฏิเสธไฟล์ผิดรูปแบบ (Phase 2)
- ✅ แจ้งเมื่อพื้นที่เก็บข้อมูลไม่พร้อม (`storage.test.ts`; ข้อความแสดงใน `App.tsx`)

**Deployment**
- 👀 ไฟล์ CSS/JS/ไอคอนโหลดได้ภายใต้ base path `/testbot/` (`vite preview`)
- ✅ เปิด URL ตรงและรีเฟรชได้ (hash routing, `router.test.ts`, `App.test.tsx`)
- ⏳ เปิดหน้าแรกจาก URL จริง / หลังอัปเดตเวอร์ชัน (รอ deploy)

**Accessibility**
- 👀 ใช้ฟังก์ชันหลักด้วยคีย์บอร์ดได้ (skip link, tab ของ timer ใช้ลูกศร, Enter/Escape ในเครื่องคิดเลข)
- 👀 Focus indicator มองเห็นได้ (`:focus-visible` outline 3px)
- ✅ ปุ่มและช่องกรอกมีชื่อ (tests ค้นหาด้วย accessible name)
- 👀 ข้อความไทยอ่านได้บนมือถือ (390px)
