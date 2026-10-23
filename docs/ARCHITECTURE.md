# สถาปัตยกรรม

Static web app ไม่มี backend ในระยะแรก ทุกอย่างทำงานในเบราว์เซอร์

```
Presentation    src/components, src/features/*/…Widget.tsx, pages
Application     src/app (App, router, registry), contexts (Settings, Favorites)
Domain/Utility  src/features/*/engine.ts|clock.ts|timer.ts  (pure functions, unit-tested)
Data access     src/lib/storage.ts, src/hooks/usePersistentState.ts
Storage         LocalStorage (ตั้งค่า, favorites)  ·  IndexedDB (แผน Phase 2)
```

## โครงสร้างโฟลเดอร์

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `src/app/` | App root, hash router, widget registry |
| `src/components/` | UI ที่ใช้ร่วมกัน (ErrorBoundary, NotFound) |
| `src/components/layout/` | AppShell: header, sidebar, search |
| `src/features/dashboard/` | Dashboard, favorites, search, WidgetFrame, ToolPage |
| `src/features/clock/` | นาฬิกา |
| `src/features/calculator/` | เครื่องคิดเลข (engine + widget) |
| `src/features/timer/` | จับเวลาและนับถอยหลัง (state machine + widget) |
| `src/features/settings/` | ธีม รูปแบบเวลา |
| `src/lib/` | storage helpers |
| `src/hooks/` | `usePersistentState`, `useNow` |
| `src/styles/` | design tokens และ global styles |
| `src/types/` | TypeScript types ที่ใช้ร่วมกัน |
| `src/test/` | test setup และ helpers |

## Widget Registry

ทุกเครื่องมือลงทะเบียนใน `src/app/registry.ts` ด้วย `WidgetDefinition` (`src/types/widget.ts`):

```ts
interface WidgetDefinition {
  id: string;                 // คงที่ ห้ามเปลี่ยน — favorites/layout อ้างอิง id นี้
  title: string;
  description: string;
  category: ToolCategory;
  keywords: readonly string[];
  defaultSize: "small" | "medium" | "large";
  supportsResize: boolean;
  supportsOffline: boolean;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>; // lazy-loaded
}
```

การเพิ่มเครื่องมือใหม่: สร้าง `src/features/<tool>/` ที่มี logic แยกจาก UI, export default component, แล้วเพิ่ม entry ใน registry

ทุกวิดเจ็ตถูกครอบด้วย `WidgetFrame` → `ErrorBoundary` → `Suspense` จึงแสดงสถานะกำลังโหลด และถ้าวิดเจ็ตพังจะไม่กระทบส่วนอื่น

## Routing

ใช้ hash routing (`#/`, `#/tools/<id>`, `#/settings`) เพราะ GitHub Pages ไม่มี server rewrite การรีเฟรชและเปิดลิงก์ตรงจึงทำงานได้เสมอ

## การจัดเก็บข้อมูล

| ข้อมูล | Key | ที่เก็บ |
| --- | --- | --- |
| การตั้งค่า | `productivity-hub:settings` | LocalStorage `{ version: 1, theme, timeFormat }` |
| Favorites | `productivity-hub:favorites` | LocalStorage `{ version: 1, ids }` |

ทุกค่ามี `version` และ parser ที่ตรวจข้อมูล ข้อมูลเสียหายจะใช้ค่าเริ่มต้นและแจ้งผู้ใช้ id ที่ไม่มีใน registry แล้วจะถูกตัดออก ถ้าเขียนข้อมูลไม่สำเร็จ (พื้นที่เต็ม/ถูกปิดกั้น) จะแสดงคำเตือน

## Design tokens

กำหนดใน `src/styles/tokens.css` (สี ระยะห่างแบบ 4px, radius, ฟอนต์ที่รองรับไทย) ธีมมืดเปลี่ยนผ่าน `data-theme="dark"` บน `<html>`
