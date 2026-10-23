import { CATEGORY_LABELS } from "../../app/registry";
import { hrefFor } from "../../app/router";
import type { WidgetDefinition } from "../../types/widget";
import "./dashboard.css";

export function ToolList({ widgets }: { widgets: readonly WidgetDefinition[] }) {
  return (
    <ul className="tool-list">
      {widgets.map((widget) => {
        const Icon = widget.icon;
        return (
          <li key={widget.id}>
            <a className="card tool-card" href={hrefFor({ name: "tool", id: widget.id })}>
              <Icon aria-hidden="true" size={22} />
              <div>
                <strong>{widget.title}</strong>
                <span>
                  {CATEGORY_LABELS[widget.category]} · {widget.description}
                </span>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
