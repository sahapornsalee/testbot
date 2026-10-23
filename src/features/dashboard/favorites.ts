export const FAVORITES_KEY = "productivity-hub:favorites";

export interface FavoritesData {
  version: 1;
  ids: string[];
}

/**
 * Validates stored favorites and drops ids that no longer exist in the
 * registry, so a removed tool can never break the dashboard.
 */
export function parseFavorites(raw: unknown, knownIds: ReadonlySet<string>): FavoritesData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.ids)) return null;
  const ids: string[] = [];
  for (const id of data.ids) {
    if (typeof id === "string" && knownIds.has(id) && !ids.includes(id)) ids.push(id);
  }
  return { version: 1, ids };
}

export function toggleFavorite(data: FavoritesData, id: string): FavoritesData {
  return {
    version: 1,
    ids: data.ids.includes(id) ? data.ids.filter((x) => x !== id) : [...data.ids, id],
  };
}
