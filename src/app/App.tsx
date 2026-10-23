import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { NotFound } from "../components/NotFound";
import { Dashboard } from "../features/dashboard/Dashboard";
import { FavoritesProvider, useFavorites } from "../features/dashboard/FavoritesContext";
import { SearchResults } from "../features/dashboard/SearchResults";
import { ToolPage } from "../features/dashboard/ToolPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SettingsProvider, useSettings } from "../features/settings/SettingsContext";
import type { StorageIssue } from "../hooks/usePersistentState";
import { useRoute, type Route } from "./router";

function renderRoute(route: Route) {
  switch (route.name) {
    case "dashboard":
      return <Dashboard />;
    case "settings":
      return <SettingsPage />;
    case "tool":
      return <ToolPage id={route.id} />;
    case "not-found":
      return <NotFound />;
  }
}

const ISSUE_MESSAGES: Partial<Record<StorageIssue, string>> = {
  unavailable: "เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล การตั้งค่าจะหายเมื่อปิดหน้า",
  "write-failed": "บันทึกข้อมูลไม่สำเร็จ พื้นที่จัดเก็บอาจเต็มหรือถูกปิดกั้น",
  recovered: "ข้อมูลที่บันทึกไว้เสียหาย ระบบจึงใช้ค่าเริ่มต้นแทน",
};

function StorageNotice() {
  const { storageIssue: settingsIssue } = useSettings();
  const { storageIssue: favoritesIssue } = useFavorites();
  const issue = [settingsIssue, favoritesIssue].find((i) => i !== "none");
  const message = issue ? ISSUE_MESSAGES[issue] : undefined;
  if (!message) return null;
  return (
    <p className="notice" role="status">
      {message}
    </p>
  );
}

function Shell() {
  const route = useRoute();
  const [query, setQuery] = useState("");
  const [prevRoute, setPrevRoute] = useState(route);
  const isFirstRoute = useRef(true);

  // Navigating (e.g. clicking a search result) closes the search view.
  if (route !== prevRoute) {
    setPrevRoute(route);
    setQuery("");
  }

  // Move focus to the new page so keyboard and screen reader users follow navigation.
  useEffect(() => {
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <AppShell route={route} query={query} onQueryChange={setQuery} notice={<StorageNotice />}>
      {query.trim() ? <SearchResults query={query.trim()} /> : renderRoute(route)}
    </AppShell>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <FavoritesProvider>
        <Shell />
      </FavoritesProvider>
    </SettingsProvider>
  );
}
