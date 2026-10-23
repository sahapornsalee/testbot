import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePersistentState, type StorageIssue } from "../../hooks/usePersistentState";
import { DEFAULT_SETTINGS, parseSettings, resolveTheme, SETTINGS_KEY, type Settings } from "./settings";

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Omit<Settings, "version">>) => void;
  resolvedTheme: "light" | "dark";
  storageIssue: StorageIssue;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function usePrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return prefersDark;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings, storageIssue] = usePersistentState(
    SETTINGS_KEY,
    parseSettings,
    DEFAULT_SETTINGS,
  );
  const prefersDark = usePrefersDark();
  const resolvedTheme = resolveTheme(settings.theme, prefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const updateSettings: SettingsContextValue["updateSettings"] = (patch) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resolvedTheme, storageIssue }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
