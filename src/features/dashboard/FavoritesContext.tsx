import { createContext, useContext, type ReactNode } from "react";
import { WIDGET_IDS, WIDGETS } from "../../app/registry";
import { usePersistentState, type StorageIssue } from "../../hooks/usePersistentState";
import { FAVORITES_KEY, parseFavorites, toggleFavorite, type FavoritesData } from "./favorites";

interface FavoritesContextValue {
  favoriteIds: readonly string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  resetFavorites: () => void;
  storageIssue: StorageIssue;
}

const DEFAULT_FAVORITES: FavoritesData = { version: 1, ids: WIDGETS.map((w) => w.id) };
const parse = (raw: unknown) => parseFavorites(raw, WIDGET_IDS);

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [data, setData, storageIssue] = usePersistentState(FAVORITES_KEY, parse, DEFAULT_FAVORITES);
  const value: FavoritesContextValue = {
    favoriteIds: data.ids,
    isFavorite: (id) => data.ids.includes(id),
    toggle: (id) => setData((prev) => toggleFavorite(prev, id)),
    resetFavorites: () => setData(DEFAULT_FAVORITES),
    storageIssue,
  };
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside FavoritesProvider");
  return value;
}
