import { Suspense } from "react";
import { Maximize2, Star } from "lucide-react";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { hrefFor } from "../../app/router";
import type { WidgetDefinition } from "../../types/widget";
import { useFavorites } from "./FavoritesContext";
import "./dashboard.css";

interface Props {
  widget: WidgetDefinition;
  /** Hide the "open full page" link when already on the tool page. */
  showOpenLink?: boolean;
}

export function WidgetFrame({ widget, showOpenLink = true }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(widget.id);
  const Icon = widget.icon;
  const Content = widget.component;
  const headingId = `widget-${widget.id}-title`;

  return (
    <section className={`card widget widget-${widget.defaultSize}`} aria-labelledby={headingId}>
      <header className="widget-header">
        <Icon aria-hidden="true" size={20} />
        <h2 id={headingId} className="widget-title">
          {widget.title}
        </h2>
        <button
          type="button"
          className={`icon-btn ${favorite ? "is-favorite" : ""}`}
          aria-pressed={favorite}
          aria-label={favorite ? `เลิกปักหมุด ${widget.title}` : `ปักหมุด ${widget.title}`}
          title={favorite ? "เลิกปักหมุด" : "ปักหมุดไว้ที่ Dashboard"}
          onClick={() => toggle(widget.id)}
        >
          <Star aria-hidden="true" size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        {showOpenLink && (
          <a
            className="icon-btn"
            href={hrefFor({ name: "tool", id: widget.id })}
            aria-label={`เปิด ${widget.title} แบบเต็มหน้า`}
            title="เปิดแบบเต็มหน้า"
          >
            <Maximize2 aria-hidden="true" size={18} />
          </a>
        )}
      </header>
      <div className="widget-body">
        <ErrorBoundary label={widget.title}>
          <Suspense fallback={<p className="widget-loading">กำลังโหลด…</p>}>
            <Content />
          </Suspense>
        </ErrorBoundary>
      </div>
    </section>
  );
}
