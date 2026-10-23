import type { WidgetDefinition } from "../../types/widget";

function normalize(text: string): string {
  return text.normalize("NFC").toLocaleLowerCase("th-TH").trim();
}

/**
 * Matches tools whose title, description, category label, or keywords contain
 * every space-separated term of the query. An empty query matches everything.
 */
export function searchWidgets(
  widgets: readonly WidgetDefinition[],
  query: string,
  categoryLabels: Readonly<Record<string, string>>,
): WidgetDefinition[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...widgets];
  return widgets.filter((widget) => {
    const haystack = normalize(
      [widget.title, widget.description, widget.category, categoryLabels[widget.category] ?? "", ...widget.keywords].join(
        " ",
      ),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
