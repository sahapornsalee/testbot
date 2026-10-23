import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";

export type WidgetSize = "small" | "medium" | "large";

export type ToolCategory = "time" | "tasks" | "ai" | "files" | "thai" | "calculate" | "money" | "life" | "developer";

/** Metadata every tool/widget must declare (see docs/ARCHITECTURE.md). */
export interface WidgetDefinition {
  /** Stable id. Never rename: stored favorites and layouts refer to it. */
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  /** Extra search terms (Thai and English). */
  keywords: readonly string[];
  defaultSize: WidgetSize;
  supportsResize: boolean;
  supportsOffline: boolean;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
}
