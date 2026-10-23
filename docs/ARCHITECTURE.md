# สถาปัตยกรรม

Static web app ไม่มี backend ทุกอย่างทำงานในเบราว์เซอร์

```
Presentation    src/components, src/features/*/…Widget.tsx, pages
Application     src/app (App, router, registry, pwa), contexts (Settings, Layout)
Domain/Utility  src/features/*/*.ts  (pure functions, unit-tested)
Data access     src/lib/storage.ts (LocalStorage), src/data (IndexedDB repositories), hooks
Storage         LocalStorage: ตั้งค่า, layout, สถานะ timer  ·  IndexedDB: tasks, notes
Offline         public/manifest.webmanifest, pwa/sw-template.js → dist/sw.js
```

## โครงสร้างโฟลเดอร์

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/app/` | App root, hash router, widget registry, service worker registration |
| `src/components/` | ErrorBoundary, NotFound, AppBanners (offline/update), layout (AppShell) |
| `src/data/` | IndexedDB wrapper (`db.ts`), models + validators (`models.ts`) |
| `src/hooks/` | `usePersistentState`, `useCollection`, `useNow`, `useCopy`, `useElementWidth` |
| `src/features/dashboard/` | Dashboard, layout logic, LayoutContext, WidgetFrame, search, ToolPage |
| `src/features/clock/` `timer/` `calendar/` | เวลา จับเวลา ปฏิทิน |
| `src/features/calculator/` `converter/` | เครื่องคิดเลข แปลงหน่วย เปอร์เซ็นต์ |
| `src/features/tasks/` `notes/` | รายการงาน บันทึก |
| `src/features/dev-tools/` | JSON, Markdown, UUID, ข้อความ |
| `src/features/settings/` | ธีม รูปแบบเวลา backup/import/export |
| `src/styles/` | design tokens และ global styles |
| `tests/e2e/` | Playwright end-to-end tests |
| `pwa/` | service worker template |

## Widget Registry

ทุกเครื่องมือลงทะเบียนใน `src/app/registry.ts` ด้วย `WidgetDefinition` (`src/types/widget.ts`) — `id` คงที่ห้ามเปลี่ยน, component เป็น `lazy()` จึงโหลดเฉพาะเมื่อใช้ ทุกวิดเจ็ตถูกครอบด้วย `WidgetFrame` → `ErrorBoundary` → `Suspense`

เพิ่มเครื่องมือใหม่: สร้าง `src/features/<tool>/` (logic แยกจาก UI + tests) export default component แล้วเพิ่ม entry ใน registry

## Dashboard layout

`src/features/dashboard/layout.ts` เป็น pure functions: `{ version: 2, columns, items: [{ id, size, hidden }] }`
- จำนวนคอลัมน์คำนวณจากความกว้างจริงของพื้นที่ (ResizeObserver) แล้วจำกัดด้วยค่าที่ผู้ใช้เลือก มือถือได้ 1 คอลัมน์เสมอ
- span ของวิดเจ็ตไม่เกินจำนวนคอลัมน์ จึงไม่ล้นจอ
- ย้ายได้ทั้งลากวาง (HTML5 DnD) และปุ่ม ↑↓ ซึ่งใช้ได้กับคีย์บอร์ดและหน้าจอสัมผัส
- id ที่ไม่มีใน registry ถูกตัดออกตอนอ่าน; ข้อมูลเสียหายใช้ค่าเริ่มต้น

## Routing

Hash routing (`#/`, `#/tools/<id>`, `#/settings`) เพราะ GitHub Pages ไม่มี server rewrite

## การจัดเก็บข้อมูล

| ข้อมูล | ที่เก็บ | Key / Store | Schema |
| --- | --- | --- | --- |
| การตั้งค่า | LocalStorage | `productivity-hub:settings` | `{ version: 1, theme, timeFormat }` |
| Dashboard | LocalStorage | `productivity-hub:layout` | `{ version: 2, columns, items }` |
| Timer | LocalStorage | `productivity-hub:timer:stopwatch` / `:countdown` | state machine ที่อิง timestamp |
| งาน | IndexedDB `productivity-hub` v1 | `tasks` | `{ id, title, done, order, createdAt, updatedAt }` |
| บันทึก | IndexedDB `productivity-hub` v1 | `notes` | `{ id, title, body, createdAt, updatedAt }` |

ทุกค่าที่อ่านกลับผ่าน parser ตรวจชนิด record ที่เสียจะถูกข้ามและแจ้งผู้ใช้ การเขียนที่ล้มเหลวแสดงข้อความเตือน

**Migration**: v0.1.0 เก็บ `productivity-hub:favorites` `{ version: 1, ids }` — เมื่อไม่มี layout ระบบสร้าง layout จาก favorites แล้วลบ key เดิมเมื่อผู้ใช้แก้ layout ครั้งแรก IndexedDB เพิ่ม migration ได้ใน `onupgradeneeded` (`src/data/db.ts`)

**Backup** (`src/features/settings/backup.ts`): `{ app: "productivity-hub", formatVersion: 1, exportedAt, settings, layout, tasks, notes }` นำเข้าแบบแทนที่ทั้งหมด ตรวจขนาด (≤10 MB) นามสกุล เวอร์ชัน และทุก record ก่อนเขียน

## PWA / Offline

- `vite.config.ts` มี plugin สร้าง `dist/sw.js` จาก `pwa/sw-template.js` พร้อมรายการไฟล์ทั้งหมดของ build และเวอร์ชัน (hash ของรายการไฟล์)
- Navigation: network-first, ออฟไลน์ใช้ `index.html` ที่ cache ไว้ · ไฟล์อื่น: cache-first (ชื่อไฟล์มี hash)
- เวอร์ชันใหม่ไม่ activate เอง แอปแสดงปุ่ม “อัปเดตตอนนี้” แล้วจึง reload เพื่อไม่ให้แท็บที่เปิดค้างใช้ไฟล์ปนกัน; cache เก่าถูกลบตอน activate
- ลงทะเบียนเฉพาะ production + secure context ด้วย scope = base path

## Design tokens

`src/styles/tokens.css` (สี ระยะห่างแบบ 4px, radius, ฟอนต์ที่รองรับไทย) ธีมมืดผ่าน `data-theme="dark"` บน `<html>`
