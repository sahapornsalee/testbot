# Productivity Hub

เว็บรวมเครื่องมืออำนวยความสะดวกแบบ **Local-first** ทำงานในเบราว์เซอร์ทั้งหมด ไม่ต้องสมัครสมาชิก ไม่ต้องมีเซิร์ฟเวอร์ และข้อมูลเก็บอยู่ในอุปกรณ์ของผู้ใช้ เผยแพร่ผ่าน GitHub Pages

## เครื่องมือที่ใช้งานได้ตอนนี้

| เครื่องมือ | ความสามารถ |
| --- | --- |
| Dashboard | ปักหมุด/เลิกปักหมุดเครื่องมือ จำค่าหลังรีเฟรช |
| ค้นหา | ค้นหาเครื่องมือจากชื่อ คำอธิบาย หมวดหมู่ ทั้งไทยและอังกฤษ |
| นาฬิกา | เวลาและวันที่ปัจจุบัน (รูปแบบไทย) เขตเวลา รองรับ 12/24 ชั่วโมง |
| เครื่องคิดเลข | + − × ÷ วงเล็บ ทศนิยม เลขติดลบ เปอร์เซ็นต์ ประวัติ 5 รายการ ใช้คีย์บอร์ดได้ |
| จับเวลา | Stopwatch พร้อมบันทึกรอบ และนับถอยหลังพร้อมเสียงเตือน แม่นยำแม้แท็บอยู่เบื้องหลัง |
| ตั้งค่า | ธีม สว่าง/มืด/ตามระบบ, รูปแบบเวลา, คืนค่าการปักหมุด |

เครื่องมืออื่น (ปฏิทิน, To-do, บันทึก, Developer Tools ฯลฯ) อยู่ใน [docs/ROADMAP.md](docs/ROADMAP.md)

## เริ่มพัฒนา

ต้องใช้ Node.js 22.12 ขึ้นไป

```bash
npm ci            # ติดตั้ง dependency ตาม lockfile
npm run dev       # เปิด development server
npm run test      # unit + component tests (Vitest)
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run build     # build สำหรับ production ไปที่ dist/
npm run preview   # เปิดดูผล build
```

## Deploy ขึ้น GitHub Pages

Workflow อยู่ที่ `.github/workflows/deploy.yml` ทุก Pull Request จะรัน lint, test และ build ส่วนการ push เข้า `main` จะ deploy ขึ้น GitHub Pages ด้วย

ต้องเปิดใช้งานครั้งแรกเอง (ขั้นตอนระดับ L4 ตาม AGENTS.md):

1. เปิด repository บน GitHub → **Settings → Pages**
2. ตั้ง **Source** เป็น **GitHub Actions**
3. merge งานเข้า `main` แล้วดูผลในแท็บ **Actions**
4. เปิด URL ที่ได้ (เช่น `https://<username>.github.io/testbot/`) แล้วทดสอบตาม [docs/TEST_PLAN.md](docs/TEST_PLAN.md)

Base path ตั้งอัตโนมัติจากชื่อ repository ถ้าใช้ custom domain หรือ repo แบบ `<username>.github.io` ให้ build ด้วย `BASE_PATH=/`

## เอกสาร

- [AGENTS.md](AGENTS.md) — กฎกลางสำหรับ AI ที่ช่วยพัฒนา
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — ข้อกำหนดระบบ
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — สถาปัตยกรรมและโครงสร้างโค้ด
- [docs/ROADMAP.md](docs/ROADMAP.md) — แผนพัฒนาเป็นระยะ
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — สถานะปัจจุบัน
- [docs/DECISIONS.md](docs/DECISIONS.md) — บันทึกการตัดสินใจ
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) — แผนการทดสอบ
- [docs/SECURITY.md](docs/SECURITY.md) — ความปลอดภัยและความเป็นส่วนตัว
- [CHANGELOG.md](CHANGELOG.md) — ประวัติการเปลี่ยนแปลง
