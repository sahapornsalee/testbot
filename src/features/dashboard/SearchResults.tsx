import { CATEGORY_LABELS, WIDGETS } from "../../app/registry";
import { searchWidgets } from "./search";
import { ToolList } from "./ToolList";

export function SearchResults({ query }: { query: string }) {
  const results = searchWidgets(WIDGETS, query, CATEGORY_LABELS);
  return (
    <>
      <h1 className="page-title">ผลการค้นหา</h1>
      <p className="page-subtitle" role="status">
        {results.length > 0
          ? `พบ ${results.length} เครื่องมือสำหรับ “${query}”`
          : `ไม่พบเครื่องมือสำหรับ “${query}” ลองค้นด้วยชื่อหรือหมวดหมู่อื่น`}
      </p>
      {results.length > 0 && <ToolList widgets={results} />}
    </>
  );
}
