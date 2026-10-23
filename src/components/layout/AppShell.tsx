import { useEffect, useId, useState, type ReactNode } from "react";
import { LayoutDashboard, Menu, Monitor, Moon, Search, Settings, Sun, X } from "lucide-react";
import { CATEGORY_LABELS, WIDGETS } from "../../app/registry";
import { hrefFor, type Route } from "../../app/router";
import { useSettings } from "../../features/settings/SettingsContext";
import type { ThemePreference } from "../../features/settings/settings";
import type { ToolCategory } from "../../types/widget";
import "./layout.css";

const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const THEME_LABEL: Record<ThemePreference, string> = {
  light: "ธีมสว่าง",
  dark: "ธีมมืด",
  system: "ธีมตามระบบ",
};

interface Props {
  route: Route;
  query: string;
  onQueryChange: (query: string) => void;
  notice?: ReactNode;
  children: ReactNode;
}

function isActive(route: Route, target: Route): boolean {
  if (route.name !== target.name) return false;
  return route.name !== "tool" || (target.name === "tool" && route.id === target.id);
}

export function AppShell({ route, query, onQueryChange, notice, children }: Props) {
  const { settings, updateSettings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const categories = (Object.keys(CATEGORY_LABELS) as ToolCategory[]).filter((c) => WIDGETS.some((w) => w.category === c));
  const ThemeIcon = settings.theme === "light" ? Sun : settings.theme === "dark" ? Moon : Monitor;

  const navLink = (target: Route, label: string, icon: ReactNode) => (
    <a
      className="nav-link"
      href={hrefFor(target)}
      aria-current={isActive(route, target) && query === "" ? "page" : undefined}
      onClick={() => {
        setMenuOpen(false);
        onQueryChange("");
      }}
    >
      {icon}
      {label}
    </a>
  );

  return (
    <div className="app-shell">
      {/* Focus the main region directly: a "#main-content" hash would be read as a route. */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <header className="app-header">
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <a className="brand" href={hrefFor({ name: "dashboard" })} onClick={() => onQueryChange("")}>
          Productivity Hub
        </a>
        <form role="search" className="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={searchId} className="visually-hidden">
            ค้นหาเครื่องมือ
          </label>
          <Search aria-hidden="true" size={18} className="search-icon" />
          <input
            id={searchId}
            type="search"
            placeholder="ค้นหาเครื่องมือ…"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onQueryChange("");
            }}
          />
        </form>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${THEME_LABEL[settings.theme]} (กดเพื่อเปลี่ยน)`}
          title={THEME_LABEL[settings.theme]}
          onClick={() => updateSettings({ theme: NEXT_THEME[settings.theme] })}
        >
          <ThemeIcon aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="app-body">
        <nav
          id="app-sidebar"
          className={`app-sidebar ${menuOpen ? "is-open" : ""}`}
          aria-label="เมนูหลัก"
        >
          {navLink({ name: "dashboard" }, "Dashboard", <LayoutDashboard aria-hidden="true" size={18} />)}
          {categories.map((category) => (
            <div key={category} className="nav-group">
              <p className="nav-group-title">{CATEGORY_LABELS[category]}</p>
              {WIDGETS.filter((w) => w.category === category).map((widget) => {
                const Icon = widget.icon;
                return (
                  <div key={widget.id}>
                    {navLink(
                      { name: "tool", id: widget.id },
                      widget.title,
                      <Icon aria-hidden="true" size={18} />,
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="nav-group">
            {navLink({ name: "settings" }, "ตั้งค่า", <Settings aria-hidden="true" size={18} />)}
          </div>
        </nav>
        {menuOpen && <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />}

        <main id="main-content" className="app-main" tabIndex={-1}>
          {notice}
          {children}
        </main>
      </div>
    </div>
  );
}
