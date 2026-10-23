# Productivity Hub

เว็บรวมเครื่องมืออำนวยความสะดวกแบบ **Local-first** ทำงานในเบราว์เซอร์ทั้งหมด ไม่ต้องสมัครสมาชิก ไม่ต้องมีเซิร์ฟเวอร์ ข้อมูลเก็บอยู่ในอุปกรณ์ของผู้ใช้ ติดตั้งเป็นแอปและใช้งานออฟไลน์ได้ เผยแพร่ผ่าน GitHub Pages

## เครื่องมือ (47 ตัว) — ใช้ได้ทั้งหมดแม้ไม่มีอินเทอร์เน็ต

| หมวด | เครื่องมือ |
| --- | --- |
| เวลาและปฏิทิน | นาฬิกา · จับเวลา/นับถอยหลัง · ปฏิทิน (พ.ศ.) และนับวัน · เวลาโลก · Pomodoro · นับถอยหลังวันสำคัญ · คำนวณอายุ (ปีนักษัตร) |
| คำนวณและแปลงค่า | เครื่องคิดเลข · แปลงหน่วย (รวมไร่ งาน วา) · คำนวณเปอร์เซ็นต์ |
| การเงิน | รายรับรายจ่าย (สรุปรายเดือน ส่งออก Excel) · หารบิล (Service/VAT) · คำนวณผ่อนบ้าน/รถ · เงินเป็นตัวอักษร (บาทถ้วน) · เทียบราคาต่อหน่วย |
| จัดการงาน | รายการงาน (To-do) · บันทึก (autosave) · บอร์ดงาน Kanban · เตือนความจำ (เตือนขณะเปิดเว็บไว้) |
| ช่วยใช้แชท AI | แปลงรูปเป็นข้อความ (OCR ไทย/อังกฤษ) · แปลงไฟล์ PDF/Word/Excel/PowerPoint เป็นข้อความ · แบ่งข้อความยาว · ปิดข้อมูลส่วนตัว (ข้อความและรูป) · คลังคำสั่ง (prompt) |
| ไฟล์ รูปภาพ และ PDF | แต่งรูป (ย่อ บีบอัด แปลงไฟล์ หมุน ครอป ลบ GPS/EXIF) · รวม/แยก PDF และรูปเป็น PDF · ลายเซ็นบนรูป/PDF |
| เรื่องเฉพาะของไทย | QR พร้อมเพย์ · ตรวจเลขบัตรประชาชน · ภาษีเงินได้บุคคลธรรมดา · วันหยุดไทย (แสดงในปฏิทิน) |
| ชีวิตประจำวันและสุขภาพ | ติดตามนิสัย (streak) · BMI และแคลอรี่ · ข้อมูลฉุกเฉิน (เบอร์ 191/1669/199… + ข้อมูลการแพทย์ของคุณ) · สุ่ม (เหรียญ เต๋า เลือกเมนู แบ่งทีม) · ตัวนับ |
| นักพัฒนาและความปลอดภัย | สมุดบันทึกลับ (เข้ารหัส AES-256) · JSON Formatter · Markdown Preview · UUID · เครื่องมือข้อความ · สร้างรหัสผ่าน · QR Code (ข้อความ/Wi-Fi) · Hash (SHA) · แปลงเลขฐาน · แปลงสี/contrast · เปรียบเทียบข้อความ |

ระบบหลัก: **Dashboard ปรับแต่งได้** (ปักหมุด ลาก/ใช้ปุ่มลูกศรจัดลำดับ ปรับขนาด ซ่อน เลือกจำนวนคอลัมน์ คืนค่าเริ่มต้น) · **ค้นหาเครื่องมือ** · **ธีม** สว่าง/มืด/ตามระบบ · **สำรอง/นำเข้าข้อมูล** เป็นไฟล์ JSON · **PWA** ติดตั้งเป็นแอปและใช้ออฟไลน์ พร้อมแจ้งเมื่อมีเวอร์ชันใหม่

## วิธีเปิดใช้งานบน GitHub Pages (ครั้งแรก)

1. **Merge โค้ดเข้า `main`** — เปิด Pull Request จาก branch งานไปที่ `main` แล้วกด Merge
2. **เปิด GitHub Pages** — ไปที่ repository → **Settings** → **Pages** → หัวข้อ *Build and deployment* → **Source** เลือก **GitHub Actions**
3. **รอ workflow** — แท็บ **Actions** → workflow *CI and Deploy* จะรัน lint, type check, tests, E2E แล้ว deploy (ประมาณ 2–4 นาที) ถ้า merge ไปก่อนเปิด Pages ให้กด **Run workflow** อีกครั้ง
4. **เปิดเว็บ** — `https://<ชื่อผู้ใช้ GitHub>.github.io/testbot/` (URL จริงแสดงใน Settings → Pages และในขั้นตอน *deploy* ของ workflow)

หลังจากนี้ทุกครั้งที่ merge เข้า `main` เว็บจะอัปเดตอัตโนมัติ ผู้ที่เปิดเว็บค้างไว้จะเห็นปุ่ม “อัปเดตตอนนี้”

> ถ้าเปลี่ยนชื่อ repository base path จะตั้งตามชื่อใหม่อัตโนมัติ ถ้าใช้ custom domain หรือ repo ชื่อ `<username>.github.io` ให้ตั้ง `BASE_PATH: /` ใน workflow

## วิธีใช้งาน

- **ติดตั้งเป็นแอป**: Chrome/Edge บนคอมพิวเตอร์ กดไอคอนติดตั้งในแถบที่อยู่ · Android กดเมนู ⋮ → *ติดตั้งแอป* · iPhone/iPad (Safari) กด *แชร์* → *เพิ่มไปยังหน้าจอโฮม*
- **ใช้ออฟไลน์**: เปิดเว็บ 1 ครั้งขณะออนไลน์ หลังจากนั้นเปิดได้แม้ไม่มีอินเทอร์เน็ต
- **จัด Dashboard**: กด “ปรับแต่ง” → ลากการ์ด หรือใช้ปุ่ม ↑↓ / เลือกขนาด / ซ่อน / ✕ นำออก / “เพิ่มเครื่องมือ” → กด “เสร็จสิ้น”
- **สำรองข้อมูล**: ตั้งค่า → “สำรองข้อมูล (ส่งออก)” ได้ไฟล์ `.json` ใช้ “นำเข้าข้อมูล” เพื่อกู้คืนหรือย้ายไปเครื่องอื่น
- ข้อมูลเก็บเฉพาะในเบราว์เซอร์ที่ใช้ ไม่ซิงก์ข้ามอุปกรณ์ และอาจหายถ้าล้างข้อมูลเว็บไซต์ จึงควรสำรองเป็นระยะ

## พัฒนาในเครื่อง

ต้องใช้ Node.js 22.12 ขึ้นไป

```bash
npm ci                 # ติดตั้ง dependency ตาม lockfile
npm run dev            # development server (http://localhost:5173/testbot/)
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm run test           # unit + component tests (Vitest)
npx playwright install chromium   # ครั้งแรกเท่านั้น
npm run test:e2e       # end-to-end tests (desktop + mobile)
npm run build          # build ไปที่ dist/ (รวม service worker)
npm run preview        # เปิดดูผล build
```

## เอกสาร

- [AGENTS.md](AGENTS.md) — กฎกลางสำหรับ AI ที่ช่วยพัฒนา
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) · [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
- [docs/SECURITY.md](docs/SECURITY.md) · [docs/RELEASE.md](docs/RELEASE.md) · [CHANGELOG.md](CHANGELOG.md)
