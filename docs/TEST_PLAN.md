# แผนการทดสอบ

## คำสั่ง

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e
```

CI รันทั้งหมดในทุก PR และ deploy เฉพาะเมื่อผ่านทุกขั้น

## Test matrix

| กลุ่ม | สิ่งที่ตรวจ | อยู่ที่ |
| --- | --- | --- |
| Unit | คำนวณ วันที่ หน่วย JSON Markdown text UUID layout storage IndexedDB backup router search timer | `src/**/*.test.ts(x)` |
| Component/Integration | Dashboard + storage, เครื่องคิดเลข, timer, tasks, notes, ทุกหน้าเครื่องมือเปิดได้ไม่พัง | `src/**/*.test.tsx` |
| E2E (desktop + mobile, Chromium) | โหลดไฟล์ครบ, ไม่ล้นจอ, เมนู, ลิงก์ตรง/รีเฟรช, ปรับแต่ง Dashboard, ลากวาง, ข้อมูลอยู่หลังรีเฟรช, export→import ข้ามเบราว์เซอร์, ไฟล์นำเข้าผิด, skip link/focus, ออฟไลน์, ความถูกต้องของเครื่องมือ, Markdown ไม่รันสคริปต์ | `tests/e2e/*.spec.ts` |

## Checklist ที่ห้ามข้าม

✅ automated test · 👀 ตรวจด้วยภาพหน้าจอ · ⏳ ทำได้หลัง deploy จริง

**Dashboard**
- ✅ เพิ่มวิดเจ็ตแล้วย้ายตำแหน่งได้ (ปุ่ม + ลากวาง) — `App.test.tsx`, `app.spec.ts`
- ✅ เปลี่ยนขนาดและซ่อนวิดเจ็ตได้ — `App.test.tsx`, `layout.test.ts`
- ✅ รีเฟรชแล้ว Layout ยังอยู่ — `app.spec.ts`
- ✅ Layout ผิดรูปแบบแล้วกลับสู่ค่าเริ่มต้น — `App.test.tsx`, `layout.test.ts`

**Calculator และ Timer**
- ✅ เลขติดลบ ทศนิยม เปอร์เซ็นต์ — `engine.test.ts`, `tools.spec.ts`
- ✅ ป้องกันหารศูนย์และค่าไม่ถูกต้อง — `engine.test.ts`
- ✅ จับเวลา หยุด เริ่มใหม่ — `timer.test.ts`, `TimerWidget.test.tsx`
- ✅ แท็บอยู่เบื้องหลังนาน / รีเฟรชระหว่างจับเวลา — `timer.test.ts`, `tools.spec.ts`

**Local Data**
- ✅ สร้าง แก้ไข ลบงาน — `TasksWidget.test.tsx`, `app.spec.ts`
- ✅ ส่งออกและนำเข้าข้อมูลกลับได้ — `backup.test.ts`, `app.spec.ts`
- ✅ ปฏิเสธไฟล์นำเข้าที่ผิดรูปแบบ — `backup.test.ts`, `app.spec.ts`
- ✅ แสดงข้อผิดพลาดเมื่อพื้นที่เก็บข้อมูลไม่พร้อม — `storage.test.ts`, `useCollection` (ข้อความ error state)

**Deployment**
- ✅ CSS JS ไอคอน manifest โหลดได้ภายใต้ base path — `app.spec.ts` (ไม่มี response ≥ 400)
- ✅ รีเฟรชและเปิด URL ตรงได้ — `app.spec.ts`
- ✅ ใช้งานออฟไลน์หลังเข้าเว็บครั้งแรก — `app.spec.ts`
- ⏳ เปิดหน้าแรกจาก URL จริง / หลังอัปเดตเวอร์ชันบน GitHub Pages

**Accessibility**
- ✅ Skip link และ focus indicator — `app.spec.ts`
- ✅ ปุ่มและช่องกรอกมีชื่อ (tests ค้นหาด้วย accessible name ทั้งหมด)
- ✅ ย้ายวิดเจ็ตด้วยคีย์บอร์ดได้ (ปุ่ม ↑↓), ปฏิทินใช้ลูกศรได้
- 👀 ข้อความไทยอ่านได้บนมือถือ 390px ทั้งธีมสว่าง/มืด
- ⏳ ทดสอบกับ screen reader จริง (VoiceOver/NVDA)
