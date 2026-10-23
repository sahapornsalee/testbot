import { findWidget } from "../../app/registry";
import { NotFound } from "../../components/NotFound";
import { WidgetFrame } from "./WidgetFrame";
import "./dashboard.css";

export function ToolPage({ id }: { id: string }) {
  const widget = findWidget(id);
  if (!widget) return <NotFound />;
  return (
    <div className="tool-page">
      <h1 className="visually-hidden">{widget.title}</h1>
      <WidgetFrame widget={widget} showOpenLink={false} />
    </div>
  );
}
