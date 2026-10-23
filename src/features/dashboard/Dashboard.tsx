import { WIDGETS } from "../../app/registry";
import type { WidgetDefinition } from "../../types/widget";
import { useFavorites } from "./FavoritesContext";
import { ToolList } from "./ToolList";
import { WidgetFrame } from "./WidgetFrame";
import "./dashboard.css";

export function Dashboard() {
  const { favoriteIds } = useFavorites();
  const pinned = favoriteIds
    .map((id) => WIDGETS.find((w) => w.id === id))
    .filter((w): w is WidgetDefinition => w !== undefined);
  const others = WIDGETS.filter((w) => !favoriteIds.includes(w.id));

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">เครื่องมือที่ปักหมุดไว้ กดดาวเพื่อเพิ่มหรือนำออก</p>

      {pinned.length === 0 ? (
        <div className="card empty-state">
          <h2>ยังไม่มีเครื่องมือที่ปักหมุด</h2>
          <p>เปิดเครื่องมือจากรายการด้านล่าง แล้วกดรูปดาวเพื่อปักหมุดไว้ที่หน้านี้</p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {pinned.map((widget) => (
            <WidgetFrame key={widget.id} widget={widget} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <section aria-labelledby="other-tools" style={{ marginTop: "var(--space-8)" }}>
          <h2 id="other-tools" className="page-title" style={{ fontSize: "1.15rem" }}>
            เครื่องมืออื่น
          </h2>
          <ToolList widgets={others} />
        </section>
      )}
    </>
  );
}
