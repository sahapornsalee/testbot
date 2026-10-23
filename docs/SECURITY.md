# ความปลอดภัยและความเป็นส่วนตัว

## ขอบเขต
เว็บ static ไม่มี backend ไม่มีระบบสมาชิก ไม่มี analytics ไม่มีการเรียก API ภายนอก ข้อมูลผู้ใช้อยู่ใน LocalStorage/IndexedDB ของเบราว์เซอร์เท่านั้น Service worker จัดการเฉพาะ request ภายใน origin และ scope ของแอป

## มาตรการปัจจุบัน
- ไม่มี API key, token หรือ secret ใน source code
- ไม่ใช้ `eval`, `new Function` หรือ `dangerouslySetInnerHTML`
- เครื่องคิดเลขใช้ parser ที่รับเฉพาะตัวเลขและเครื่องหมายที่อนุญาต
- Markdown แปลงเป็น React elements โดยตรง HTML แสดงเป็นข้อความ ลิงก์อนุญาตเฉพาะ http/https/mailto และเปิดด้วย `rel="noopener noreferrer nofollow"` (มี unit + E2E test ยืนยัน)
- ข้อมูลที่อ่านจาก storage และไฟล์นำเข้าถือว่าไม่น่าเชื่อถือ: ตรวจ version ชนิด ความยาว และโครงสร้างทุก record
- ไฟล์นำเข้า: ≤ 10 MB, ต้องเป็น `.json`, ต้องมี `app: "productivity-hub"` และ `formatVersion` ที่รองรับ, ไม่รันโค้ดใด ๆ จากไฟล์, แสดงสรุปและขอยืนยันก่อนแทนที่
- การลบข้อมูลทั้งหมด/ล้างงาน/ลบบันทึก ต้องยืนยันก่อน
- Route parameter รับเฉพาะ `[a-z0-9-]`
- ErrorBoundary log เฉพาะข้อความ error ไม่ log ข้อมูลผู้ใช้
- GitHub Actions: สิทธิ์เริ่มต้น `contents: read`; เฉพาะ job deploy ได้ `pages: write` และ `id-token: write`, deploy เฉพาะจาก `main` หลังผ่านทุก check
- Runtime dependency มี 4 ตัว (react, react-dom, lucide-react, qrcode-generator); `npm audit` ไม่พบช่องโหว่ ณ วันที่ release

- รหัสผ่านสร้างด้วย `crypto.getRandomValues` และไม่ถูกบันทึก; Hash คำนวณด้วย Web Crypto ในเครื่อง ไฟล์ไม่ถูกอัปโหลด
- CSV ที่ส่งออกจากรายรับรายจ่าย ป้องกัน formula injection (ค่าที่ขึ้นต้นด้วย `= + - @` ถูกนำหน้าด้วย `'`)
- ข้อมูลทางการแพทย์ในเครื่องมือข้อมูลฉุกเฉินเก็บใน LocalStorage ของเครื่องนี้เท่านั้น และมีคำเตือนเรื่องอุปกรณ์ที่ใช้ร่วมกัน
- QR Code วาดเป็น SVG ผ่าน React ไม่ใช้ HTML string จากไลบรารี

## ข้อจำกัดที่ต้องเข้าใจ
LocalStorage และ IndexedDB ไม่ได้เข้ารหัส สคริปต์อันตรายหรือส่วนขยายเบราว์เซอร์อาจอ่านได้ ข้อมูลอาจถูกล้างโดยเบราว์เซอร์ และไฟล์สำรองเป็นข้อความธรรมดา อย่าเก็บรหัสผ่านหรือข้อมูลลับในบันทึก และอย่าใช้บนอุปกรณ์สาธารณะ

## การรายงานปัญหา
เปิด issue ใน repository โดยไม่ใส่ข้อมูลส่วนตัว
