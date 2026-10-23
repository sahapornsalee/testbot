# Release และ Rollback

## Release
1. ตรวจว่า PR ผ่าน workflow *CI and Deploy* (lint, typecheck, unit, build, E2E)
2. อัปเดต `CHANGELOG.md` และ `version` ใน `package.json`
3. Merge เข้า `main` → workflow deploy ขึ้น GitHub Pages อัตโนมัติ
4. เปิด URL จริง ตรวจ: หน้าแรกโหลด, เปิด `#/tools/notes` ตรง, รีเฟรช, ข้อมูลยังอยู่, ใช้บนมือถือ, ปิดเน็ตแล้วเปิดใหม่ได้
5. ผู้ที่เปิดเว็บค้างไว้จะเห็นปุ่ม “อัปเดตตอนนี้”

## Rollback
- **เร็วที่สุด:** GitHub → Actions → เลือก run ของ *CI and Deploy* ที่ deploy สำเร็จครั้งก่อน → **Re-run all jobs** (deploy artifact ของ commit นั้นอีกครั้ง)
- **ถาวร:** `git revert <commit>` บน branch ใหม่ → PR → merge เข้า `main`
- Service worker เวอร์ชันใหม่ (จาก rollback) จะลบ cache เก่าเมื่อ activate ผู้ใช้จะเห็นปุ่มอัปเดตเหมือนปกติ
- ถ้าเปลี่ยน schema ข้อมูลใน release ที่มีปัญหา ให้ผู้ใช้ “สำรองข้อมูล” ก่อน แล้วนำเข้าหลัง rollback (parser ปฏิเสธ `formatVersion` ที่ใหม่กว่า จึงไม่เขียนทับข้อมูลผิดรูปแบบ)
