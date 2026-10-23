import { createContext, useContext, type ReactNode } from "react";
import { WIDGETS } from "../../app/registry";
import { usePersistentState, type StorageIssue } from "../../hooks/usePersistentState";
import { readJson, removeKey } from "../../lib/storage";
import {
  createDefaultLayout,
  LAYOUT_KEY,
  LEGACY_FAVORITES_KEY,
  migrateLegacyFavorites,
  parseLayout,
  type DashboardLayout,
} from "./layout";

export const DEFAULT_DASHBOARD_IDS = ["clock", "tasks", "calculator", "timer", "notes"];

export function defaultLayout(): DashboardLayout {
  return createDefaultLayout(WIDGETS, DEFAULT_DASHBOARD_IDS);
}

export const parseStoredLayout = (raw: unknown) => parseLayout(raw, WIDGETS);

/** Initial layout: stored layout, else migrated v0.1.0 favorites, else defaults. */
function initialLayout(): DashboardLayout {
  const legacy = readJson(LEGACY_FAVORITES_KEY, (raw) => migrateLegacyFavorites(raw, WIDGETS), null);
  return legacy.value ?? defaultLayout();
}

interface LayoutContextValue {
  layout: DashboardLayout;
  update: (change: (prev: DashboardLayout) => DashboardLayout) => void;
  reset: () => void;
  storageIssue: StorageIssue;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout, storageIssue] = usePersistentState(LAYOUT_KEY, parseStoredLayout, initialLayout);
  const value: LayoutContextValue = {
    layout,
    update: (change) => {
      setLayout(change);
      removeKey(LEGACY_FAVORITES_KEY);
    },
    reset: () => setLayout(defaultLayout()),
    storageIssue,
  };
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const value = useContext(LayoutContext);
  if (!value) throw new Error("useLayout must be used inside LayoutProvider");
  return value;
}
