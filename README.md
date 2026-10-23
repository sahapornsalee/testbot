# Universal Downloader

**ภาษาไทย** · [English](README.en.md)

เว็บแอปสำหรับวางลิงก์ → ตรวจสอบว่าลิงก์นั้นคืออะไรจริง ๆ (ชนิดไฟล์, ขนาด, การเปลี่ยนเส้นทาง, รูปแบบสื่อที่มีอยู่จริง) → แล้วดาวน์โหลดผ่านคิวงานที่ยกเลิกได้ รองรับภาษาไทยและภาษาอังกฤษ

- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS (`apps/web`)
- **Backend:** Python + FastAPI + HTTPX + yt-dlp + FFmpeg + SQLite (`services/api`)
- **รูปแบบการใช้งาน:** Local Mode (Windows 11) และ Online Mode (Docker / แพลตฟอร์มที่รัน container ได้)

> ⚠️ ดาวน์โหลดเฉพาะเนื้อหาที่คุณมีสิทธิ์ ระบบนี้ **ไม่** หลบเลี่ยง DRM, paywall, การล็อกอิน หรือ CAPTCHA และไม่รับประกันว่าดาวน์โหลดได้ทุกเว็บไซต์

## เปิดใช้งานออนไลน์บน GitHub (Codespaces) — ไม่ต้องติดตั้งอะไรในเครื่อง

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/sahapornsalee/testbot?quickstart=1)

1. กดปุ่มด้านบน (หรือในหน้า repo: **Code → Codespaces → Create codespace on main**)
2. รอประมาณ 3–5 นาทีในครั้งแรก ระบบจะติดตั้ง Python, Node.js, FFmpeg, yt-dlp และ build หน้าเว็บให้อัตโนมัติ
3. เมื่อเสร็จ หน้าเว็บจะเปิดในแท็บใหม่ (ถ้าไม่เปิด: แท็บ **PORTS** → พอร์ต `3000` → กดไอคอนลูกโลก)
4. ใช้งานได้ทันที — ไฟล์ที่ดาวน์โหลดจะถูกบันทึกลงเครื่องผ่านปุ่ม **บันทึกไฟล์** ของเบราว์เซอร์

คำสั่งใน Terminal ของ Codespace:

```bash
bash scripts/codespaces/start.sh   # เริ่มใหม่ (ทำอัตโนมัติทุกครั้งที่เปิด codespace)
bash scripts/codespaces/stop.sh    # หยุด
tail -f data/logs/api.log          # ดู log
git pull && bash scripts/codespaces/start.sh   # อัปเดตเป็นเวอร์ชันล่าสุด (ติดตั้ง/build ใหม่ให้เองถ้าโค้ดเปลี่ยน)
```

ถ้าหน้าเว็บขึ้นว่า **"เชื่อมต่อเซิร์ฟเวอร์ API ไม่ได้"** แปลว่า API ไม่ได้ทำงาน ให้รัน `bash scripts/codespaces/start.sh` อีกครั้ง แล้วดูสาเหตุด้วย `tail -n 30 data/logs/api.log`

**ความปลอดภัยและค่าใช้จ่าย**

- URL ของ Codespace เป็น **private** — เปิดได้เฉพาะบัญชี GitHub ของคุณ **อย่าเปลี่ยนพอร์ต 3000 เป็น Public** เพราะโหมดนี้ไม่มีระบบ login ใครได้ลิงก์ไปก็ใช้เซิร์ฟเวอร์ดาวน์โหลดของคุณได้
- บัญชีส่วนตัวได้โควต้าฟรีรายเดือน (เครื่อง 2 core ใช้ได้ประมาณ 60 ชั่วโมง/เดือน) เกินแล้วจะถูกเก็บเงินถ้าตั้ง spending limit ไว้มากกว่า 0 — ปิด codespace เมื่อไม่ใช้ (ระบบหยุดเองหลังไม่ได้ใช้ 30 นาที) ดูโควต้าที่ <https://github.com/settings/billing>
- Codespace เหมาะกับการใช้งานส่วนตัว ไม่ใช่เซิร์ฟเวอร์สาธารณะ ถ้าต้องการให้คนอื่นใช้ ดู [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- GitHub Pages ใช้ไม่ได้ เพราะรองรับเฉพาะไฟล์ static รัน API, yt-dlp และ FFmpeg ไม่ได้

## สิ่งที่ทำได้ในเวอร์ชันนี้ (MVP)

| ความสามารถ | สถานะ |
|---|---|
| วิเคราะห์ URL (scheme, hostname, DNS, redirect, Content-Type, ขนาด, ชื่อไฟล์, magic bytes) | ✅ |
| ป้องกัน SSRF (IP ภายใน, metadata ของคลาวด์, DNS rebinding, redirect ไปยังเครือข่ายภายใน) | ✅ |
| ดาวน์โหลดไฟล์โดยตรงแบบ streaming จำกัดขนาด/เวลา ดาวน์โหลดต่อด้วย Range เมื่อการเชื่อมต่อหลุด | ✅ |
| ตรวจสอบสื่อด้วย yt-dlp แสดงเฉพาะ format ที่มีอยู่จริง และรวมเสียงด้วย FFmpeg | ✅ (ทดสอบด้วย fixture; การทดสอบกับเว็บจริงเป็นแบบ optional) |
| คิวงาน: queued → inspecting → downloading → processing → completed / failed / cancelled / expired | ✅ |
| **ดาวน์โหลดหลายการเชื่อมต่อ (แบบ IDM):** แบ่งไฟล์เป็นส่วน ๆ ดาวน์โหลดพร้อมกันสูงสุด 8 การเชื่อมต่อ ส่วนที่หลุดจะต่อเอง | ✅ (เมื่อเซิร์ฟเวอร์รองรับ Range) |
| **หยุดชั่วคราว / ดาวน์โหลดต่อ:** เก็บไฟล์ที่โหลดไปแล้ว เซิร์ฟเวอร์รีสตาร์ตงานจะถูกพักไว้ให้กดต่อได้ ถ้าไฟล์ต้นทางเปลี่ยนจะเริ่มใหม่อัตโนมัติ | ✅ (ไฟล์โดยตรง) |
| **ดึงทุกอย่างจากหน้าเว็บ:** วางลิงก์หน้าเว็บแล้วเลือกโหลดได้ทุกอย่าง — รูป (รวม lazy-load และ background ใน CSS), วิดีโอ, เสียง, เอกสาร, ไฟล์บีบอัด, สตรีมวิดีโอที่ซ่อนอยู่ในสคริปต์ของเครื่องเล่น, วิดีโอฝัง (เช่น YouTube), ลิงก์อื่น ๆ และตัวหน้าเว็บเอง (.html) เลือกได้ไม่จำกัด ระบบแบ่งส่งทีละ 50 ให้เอง | ✅ (หน้าที่ใช้ JavaScript สร้างเนื้อหาหลังโหลดอาจหาไม่ครบ) |
| **สตรีม HLS (.m3u8):** เลือกความละเอียดที่มีจริง ดาวน์โหลดหลายการเชื่อมต่อ หยุด/ต่อได้ รองรับการเข้ารหัส AES-128 ทั่วไป และแปลงเป็น MP4 ด้วย FFmpeg | ✅ (ไม่รองรับสตรีมสด, DRM และ DASH .mpd) |
| **เพิ่มหลายลิงก์พร้อมกัน:** วางได้ครั้งละ 50 ลิงก์ | ✅ |
| ยกเลิกงาน, ล้างไฟล์ชั่วคราวและไฟล์หมดอายุอัตโนมัติ | ✅ |
| ภาษาไทย/อังกฤษ, รองรับมือถือ แท็บเล็ต เดสก์ท็อป | ✅ |
| Authentication แบบ bearer token สำหรับ Online Mode | ✅ (แบบพื้นฐาน — ดู [docs/SECURITY.md](docs/SECURITY.md)) |
| Playlist, บัญชีผู้ใช้หลายคน, worker แยก container | ❌ ยังไม่ทำ (ดู “ข้อจำกัด”) |

---

## การติดตั้งบน Windows 11 (Local Mode)

คำสั่งทั้งหมดด้านล่างเป็น **PowerShell** ให้เปิด *Windows Terminal → PowerShell*

### 1. Prerequisites

| โปรแกรม | เวอร์ชัน | จำเป็น |
|---|---|---|
| Git | ล่าสุด | ใช้สำหรับ clone/commit (ไม่บังคับถ้าดาวน์โหลด zip) |
| Python | 3.11 ขึ้นไป (แนะนำ 3.12) | ✅ |
| Node.js | 20.9 ขึ้นไป (แนะนำ 22 LTS) | ✅ |
| FFmpeg | ล่าสุด | ไม่บังคับ (จำเป็นสำหรับการรวมเสียงกับวิดีโอ) |

### 2. ติดตั้ง Git, Node.js, Python และ FFmpeg

```powershell
winget install -e --id Git.Git
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Gyan.FFmpeg
```

ปิดแล้วเปิด Terminal ใหม่ เพื่อให้ PATH อัปเดต

### 3. ตรวจสอบเวอร์ชัน

```powershell
git --version
py -3 --version
node --version
npm.cmd --version
ffmpeg -version
```

หรือใช้สคริปต์ตรวจสอบทั้งหมด (เครื่องมือ, venv, `.env`, พอร์ต):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check.ps1
```

> `-ExecutionPolicy Bypass` มีผลกับคำสั่งนี้ครั้งเดียว ไม่ได้เปลี่ยนนโยบายของทั้งระบบ

### 4. สร้าง virtual environment

```powershell
cd services\api
py -3 -m venv .venv
```

### 5. ติดตั้ง Python dependencies

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\..
```

### 6. ติดตั้ง Node dependencies

```powershell
cd apps\web
npm.cmd ci
cd ..\..
```

> ใช้ `npm.cmd` แทน `npm` เพื่อหลีกเลี่ยงข้อความเตือนเรื่อง execution policy ของ `npm.ps1` โดยไม่ต้องปิด execution policy ของระบบ

ขั้นตอน 4–6 ทำให้อัตโนมัติได้ด้วย `.\scripts\dev.ps1 -Install`

### 7. ตั้งค่า `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

ค่าที่ควรรู้: `MAX_FILE_SIZE_MB`, `MAX_CONCURRENT_JOBS`, `TEMP_FILE_TTL_HOURS`, `FFMPEG_LOCATION` (ถ้า ffmpeg ไม่อยู่ใน PATH) ห้าม commit ไฟล์ `.env`

### 8. เริ่ม API

```powershell
cd services\api
.\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

ทดสอบ: เปิด <http://127.0.0.1:8000/api/v1/health> และเอกสาร API แบบโต้ตอบที่ <http://127.0.0.1:8000/api/docs>

### 9. เริ่ม Frontend (อีกหน้าต่างหนึ่ง)

```powershell
cd apps\web
npm.cmd run dev
```

เปิด <http://localhost:3000> — Frontend จะส่งต่อ `/api/v1/*` ไปยัง API ผ่าน `API_INTERNAL_URL` (ค่าเริ่มต้น `http://127.0.0.1:8000`)

**ทางลัด:** `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1` เริ่มทั้ง API (เบื้องหลัง) และ Frontend ในคำสั่งเดียว

### 10. รัน Tests

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1          # lint + unit + integration + security + frontend + build
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1 -E2E     # เพิ่ม Playwright E2E
```

ครั้งแรกที่รัน E2E ให้ติดตั้งเบราว์เซอร์: `cd apps\web; npx.cmd playwright install chromium`
รายละเอียดดูที่ [docs/TESTING.md](docs/TESTING.md)

### 11. แก้ปัญหาพอร์ตชนกัน

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8000,3000 | Select-Object LocalPort, OwningProcess
Get-Process -Id <OwningProcess>
Stop-Process -Id <OwningProcess>      # ถ้าแน่ใจว่าเป็นโปรแกรมที่ปิดได้
```

หรือใช้พอร์ตอื่น: `.\scripts\dev.ps1 -ApiPort 8001 -WebPort 3001`
(ถ้าเปลี่ยนพอร์ตเว็บ ให้เพิ่ม `http://localhost:3001` ใน `ALLOWED_ORIGINS` ของ `.env`)

### 12. แก้ปัญหา FFmpeg ไม่อยู่ใน PATH

1. ตรวจสอบ: `Get-Command ffmpeg` — ถ้าไม่พบ ให้เปิด Terminal ใหม่หลังติดตั้ง
2. ถ้ายังไม่พบ ให้ระบุตำแหน่งตรงใน `.env` เช่น
   `FFMPEG_LOCATION=C:\ffmpeg\bin\ffmpeg.exe` (หรือโฟลเดอร์ `C:\ffmpeg\bin`)
3. ตรวจผลที่หน้า **Settings → Server status** หรือ `/api/v1/health` (ช่อง `tools.ffmpeg`)

ถ้าไม่มี FFmpeg ระบบยังดาวน์โหลดไฟล์ได้ตามปกติ แต่จะรวมเสียงเข้ากับ format ที่มีแต่วิดีโอไม่ได้

### 13. ตรวจสอบ log

- ถ้าเริ่มด้วย `scripts\dev.ps1`: `Get-Content data\logs\api.log -Tail 50 -Wait` และ `data\logs\api.err.log`
- ถ้าเริ่ม API เอง: log แบบ JSON จะแสดงในหน้าต่างนั้น
- Log บันทึกเฉพาะ path ของ request ไม่บันทึก query string, URL ที่ผู้ใช้วาง, cookies หรือ token

### 14. หยุดบริการ

กด `Ctrl+C` ในหน้าต่างที่รันอยู่ (`dev.ps1` จะหยุด API ให้อัตโนมัติ) ถ้ามี process ค้าง: ดูข้อ 11
สำหรับ Docker: `docker compose down`

### 15. ล้าง temporary files

ระบบลบไฟล์ที่เสร็จแล้วอัตโนมัติหลัง `TEMP_FILE_TTL_HOURS` และลบไฟล์ชั่วคราวที่ค้าง ถ้าต้องการล้างเองทั้งหมด (หยุด API ก่อน):

```powershell
Remove-Item -Recurse -Force services\api\data\tmp, services\api\data\downloads
```

> คำสั่งนี้ลบไฟล์ที่ดาวน์โหลดไว้ทั้งหมด ประวัติงานใน `app.db` ยังอยู่

### 16. Build production

```powershell
cd apps\web
$env:API_INTERNAL_URL = "http://127.0.0.1:8000"
npm.cmd run build
npm.cmd run start
```

API สำหรับ production: ตั้ง `APP_ENV=production`, `AUTH_REQUIRED=true`, `API_TOKENS=...` แล้วรัน uvicorn ตามข้อ 8 (ดู [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))

### 17. เริ่มระบบผ่าน Docker Compose

ต้องมี Docker Desktop

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f api
docker compose down
```

เปิด <http://localhost:3000> พอร์ตถูกผูกกับ `127.0.0.1` เท่านั้น (เข้าถึงได้จากเครื่องนี้เครื่องเดียว)

---

## ใช้งานกับ GitHub

โปรเจกต์นี้พร้อมสำหรับ GitHub แล้ว: มี `.gitignore` (กัน `.env`, ฐานข้อมูล, ไฟล์ดาวน์โหลด), `LICENSE` (MIT) และ GitHub Actions (`.github/workflows/ci.yml`) ที่รัน lint, unit/integration/security tests, dependency audit, frontend build, Playwright E2E และ Docker build ทุกครั้งที่ push หรือเปิด pull request โดย **ไม่ใช้ secrets และไม่ deploy อัตโนมัติ**

ถ้าเริ่มจากโฟลเดอร์ใหม่ที่ยังไม่มี Git:

```powershell
git init
git add .
git commit -m "Initial Universal Downloader MVP"
```

เมื่อสร้าง Repository เปล่าบน GitHub เองแล้ว (ไม่ต้องติ๊กสร้าง README/.gitignore):

```powershell
git branch -M main
git remote add origin https://github.com/<ชื่อผู้ใช้>/<ชื่อ-repo>.git
git push -u origin main
```

ก่อน push ให้ตรวจ `git status` ว่าไม่มี `.env`, `*.db` หรือโฟลเดอร์ `data/` หลุดเข้ามา

## เอกสารเพิ่มเติม

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — โครงสร้างระบบและการแยกโมดูล
- [docs/API.md](docs/API.md) — endpoint, schema และ error codes
- [docs/SECURITY.md](docs/SECURITY.md) — SSRF, ความปลอดภัยของไฟล์ และสิ่งที่ต้องทำก่อนเปิดสาธารณะ
- [docs/TESTING.md](docs/TESTING.md) — ชุดทดสอบและวิธีรัน
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Local, Docker และ Online deployment

## ข้อจำกัดที่ควรรู้

- ดาวน์โหลดได้เฉพาะสิ่งที่เข้าถึงได้แบบสาธารณะ ไม่รองรับเนื้อหาที่ต้องล็อกอิน, DRM หรือ paywall
- yt-dlp ทำ network request เอง (ไม่ผ่านตัวป้องกัน SSRF ระดับการเชื่อมต่อ) จึงเปิดใช้เฉพาะเว็บไซต์ที่มี extractor เฉพาะ และควรจำกัด egress ของเครื่องที่รัน API ใน Online Mode — ดู [docs/SECURITY.md](docs/SECURITY.md)
- Job runner ทำงานใน process เดียวกับ API (เหมาะกับเครื่องเดียว) งานที่ค้างตอนรีสตาร์ตจะถูกทำเครื่องหมาย `failed` (`INTERRUPTED`)
- Rate limit เก็บในหน่วยความจำ ถ้ารันหลาย process ต้องย้ายไป Redis หรือ reverse proxy
- ไม่รองรับ playlist ในเวอร์ชันนี้
- ยังไม่รองรับ DASH (`.mpd`), สตรีมสด และสตรีมที่มี DRM และไม่มี browser extension ที่ดักการดาวน์โหลดจากเบราว์เซอร์แบบ IDM
- หน้าเว็บที่สร้างเนื้อหาด้วย JavaScript หลังโหลด (เช่น infinite scroll) ระบบเห็นเฉพาะสิ่งที่อยู่ใน HTML ตอนโหลดครั้งแรก
- หยุดชั่วคราวได้เฉพาะไฟล์โดยตรง งานสื่อจาก yt-dlp ยกเลิกได้แต่หยุดชั่วคราวไม่ได้

## License

[MIT](LICENSE)
