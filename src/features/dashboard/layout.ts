import { isRecord } from "../../lib/storage";
import type { WidgetSize } from "../../types/widget";

export const LAYOUT_KEY = "productivity-hub:layout";
/** Version 0.1.0 stored pinned tools here; migrated into the layout. */
export const LEGACY_FAVORITES_KEY = "productivity-hub:favorites";

export type ColumnSetting = "auto" | 1 | 2 | 3 | 4;

export interface LayoutItem {
  id: string;
  size: WidgetSize;
  hidden: boolean;
}

export interface DashboardLayout {
  version: 2;
  columns: ColumnSetting;
  items: LayoutItem[];
}

export interface WidgetInfo {
  id: string;
  defaultSize: WidgetSize;
  supportsResize: boolean;
}

const SIZES: readonly WidgetSize[] = ["small", "medium", "large"];
const COLUMNS: readonly ColumnSetting[] = ["auto", 1, 2, 3, 4];

export const SIZE_SPAN: Record<WidgetSize, number> = { small: 1, medium: 2, large: 3 };

export function createDefaultLayout(widgets: readonly WidgetInfo[], ids: readonly string[]): DashboardLayout {
  return {
    version: 2,
    columns: "auto",
    items: ids.flatMap((id) => {
      const widget = widgets.find((w) => w.id === id);
      return widget ? [{ id, size: widget.defaultSize, hidden: false }] : [];
    }),
  };
}

/**
 * Validates a stored layout. Unknown widget ids and duplicates are dropped so
 * a removed tool can never break the dashboard; invalid sizes fall back to the
 * widget default.
 */
export function parseLayout(raw: unknown, widgets: readonly WidgetInfo[]): DashboardLayout | null {
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.items)) return null;
  const items: LayoutItem[] = [];
  for (const entry of raw.items) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const widget = widgets.find((w) => w.id === entry.id);
    if (!widget || items.some((i) => i.id === entry.id)) continue;
    const size =
      widget.supportsResize && SIZES.includes(entry.size as WidgetSize) ? (entry.size as WidgetSize) : widget.defaultSize;
    items.push({ id: widget.id, size, hidden: entry.hidden === true });
  }
  const columns = COLUMNS.includes(raw.columns as ColumnSetting) ? (raw.columns as ColumnSetting) : "auto";
  return { version: 2, columns, items };
}

/** Migrates the v0.1.0 favorites list ({ version: 1, ids }) to a layout. */
export function migrateLegacyFavorites(raw: unknown, widgets: readonly WidgetInfo[]): DashboardLayout | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.ids)) return null;
  const ids = raw.ids.filter((id): id is string => typeof id === "string");
  return createDefaultLayout(widgets, [...new Set(ids)]);
}

export function hasWidget(layout: DashboardLayout, id: string): boolean {
  return layout.items.some((i) => i.id === id);
}

export function addWidget(layout: DashboardLayout, widget: WidgetInfo): DashboardLayout {
  if (hasWidget(layout, widget.id)) return layout;
  return { ...layout, items: [...layout.items, { id: widget.id, size: widget.defaultSize, hidden: false }] };
}

export function removeWidget(layout: DashboardLayout, id: string): DashboardLayout {
  return { ...layout, items: layout.items.filter((i) => i.id !== id) };
}

export function toggleWidget(layout: DashboardLayout, widget: WidgetInfo): DashboardLayout {
  return hasWidget(layout, widget.id) ? removeWidget(layout, widget.id) : addWidget(layout, widget);
}

/** Moves the item `id` to `toIndex` (clamped). */
export function moveWidget(layout: DashboardLayout, id: string, toIndex: number): DashboardLayout {
  const from = layout.items.findIndex((i) => i.id === id);
  if (from === -1) return layout;
  const target = Math.max(0, Math.min(layout.items.length - 1, toIndex));
  if (target === from) return layout;
  const items = [...layout.items];
  const [item] = items.splice(from, 1);
  items.splice(target, 0, item as LayoutItem);
  return { ...layout, items };
}

export function setWidgetSize(layout: DashboardLayout, widget: WidgetInfo, size: WidgetSize): DashboardLayout {
  if (!widget.supportsResize) return layout;
  return { ...layout, items: layout.items.map((i) => (i.id === widget.id ? { ...i, size } : i)) };
}

export function setWidgetHidden(layout: DashboardLayout, id: string, hidden: boolean): DashboardLayout {
  return { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, hidden } : i)) };
}

export function setColumns(layout: DashboardLayout, columns: ColumnSetting): DashboardLayout {
  return { ...layout, columns };
}

/** Number of grid columns that fit `width` px, capped by the user setting. */
export function resolveColumns(width: number, setting: ColumnSetting): number {
  const fit = width >= 1320 ? 4 : width >= 960 ? 3 : width >= 600 ? 2 : 1;
  return setting === "auto" ? fit : Math.min(setting, fit);
}

export function spanFor(size: WidgetSize, columns: number): number {
  return Math.min(SIZE_SPAN[size], columns);
}

/**
 * Widens cards so every grid row is completely filled, keeping the user's
 * order. Cards are placed row by row; when the next card does not fit, the
 * leftover columns of the current row go to its narrowest cards first.
 */
export function fillRows(spans: readonly number[], columns: number): number[] {
  const result = spans.map((span) => Math.max(1, Math.min(span, columns)));
  let row: number[] = [];
  let used = 0;

  const closeRow = () => {
    let leftover = columns - used;
    while (leftover > 0 && row.length > 0) {
      const narrowest = row.reduce((best, i) => ((result[i] as number) < (result[best] as number) ? i : best));
      result[narrowest] = (result[narrowest] as number) + 1;
      leftover--;
    }
    row = [];
    used = 0;
  };

  result.forEach((span, index) => {
    if (used + span > columns) closeRow();
    row.push(index);
    used += span;
  });
  closeRow();
  return result;
}
