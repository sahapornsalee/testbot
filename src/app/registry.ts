import { lazy } from "react";
import { Calculator, Clock, Timer } from "lucide-react";
import type { ToolCategory, WidgetDefinition } from "../types/widget";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  time: "เวลาและปฏิทิน",
  calculate: "คำนวณและแปลงค่า",
  tasks: "จัดการงาน",
  developer: "เครื่องมือนักพัฒนา",
};

/**
 * Every available tool. Components are lazy-loaded so opening the app does
 * not download every tool at once. Only list tools that actually work.
 */
export const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "clock",
    title: "นาฬิกา",
    description: "เวลาและวันที่ปัจจุบันตามอุปกรณ์",
    category: "time",
    keywords: ["clock", "time", "date", "เวลา", "วันที่"],
    defaultSize: "small",
    supportsResize: false,
    supportsOffline: true,
    icon: Clock,
    component: lazy(() => import("../features/clock/ClockWidget")),
  },
  {
    id: "calculator",
    title: "เครื่องคิดเลข",
    description: "บวก ลบ คูณ หาร วงเล็บ และเปอร์เซ็นต์",
    category: "calculate",
    keywords: ["calculator", "calc", "math", "percent", "คิดเลข", "คำนวณ", "เปอร์เซ็นต์"],
    defaultSize: "medium",
    supportsResize: false,
    supportsOffline: true,
    icon: Calculator,
    component: lazy(() => import("../features/calculator/CalculatorWidget")),
  },
  {
    id: "timer",
    title: "จับเวลา",
    description: "นาฬิกาจับเวลาและนับถอยหลัง",
    category: "time",
    keywords: ["timer", "stopwatch", "countdown", "จับเวลา", "นับถอยหลัง"],
    defaultSize: "medium",
    supportsResize: false,
    supportsOffline: true,
    icon: Timer,
    component: lazy(() => import("../features/timer/TimerWidget")),
  },
];

export const WIDGET_IDS: ReadonlySet<string> = new Set(WIDGETS.map((w) => w.id));

export function findWidget(id: string): WidgetDefinition | undefined {
  return WIDGETS.find((w) => w.id === id);
}
