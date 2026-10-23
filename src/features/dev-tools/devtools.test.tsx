import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { findJsonErrorOffset, lineColumn, transformJson } from "./json";
import { MarkdownView, parseBlocks, safeUrl } from "./markdown";
import { applyTransform, decodeBase64, encodeBase64, textStats } from "./text";
import { generateUuids, isUuid, uuidV4 } from "./uuid";

describe("json", () => {
  it("formats, minifies and sorts keys", () => {
    expect(transformJson('{"b":1,"a":[1,2]}', "format")).toEqual({ ok: true, output: '{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}' });
    expect(transformJson('{ "a" : 1 }', "minify")).toEqual({ ok: true, output: '{"a":1}' });
    expect(transformJson('{"b":{"d":1,"c":2},"a":0}', "minify", { sortKeys: true })).toEqual({
      ok: true,
      output: '{"a":0,"b":{"c":2,"d":1}}',
    });
    expect(transformJson("[1]", "format", { indent: "\t" })).toEqual({ ok: true, output: "[\n\t1\n]" });
  });

  it("reports errors with a location", () => {
    const result = transformJson('{\n  "a": 1,\n}', "format");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBe(3);
      expect(result.error).toContain("บรรทัด 3");
    }
    expect(transformJson("  ", "format")).toEqual({ ok: false, error: "กรุณาวาง JSON" });
  });

  it("locates syntax errors independently of the engine's message", () => {
    expect(findJsonErrorOffset('{"a":}')).toBe(5);
    expect(findJsonErrorOffset("[1,2,]")).toBe(5);
    expect(findJsonErrorOffset('{"a":1} x')).toBe(8);
    expect(findJsonErrorOffset('"unterminated')).toBe(13);
    expect(findJsonErrorOffset("tru")).toBe(3);
    expect(findJsonErrorOffset("01")).toBe(1);
    expect(findJsonErrorOffset('{"a":[1,{"b":null}],"c":"\\u00e9"}')).toBe(-1);
    expect(transformJson('{\n  "a": tru\n}', "format")).toMatchObject({ ok: false, line: 2, column: 11 });
  });

  it("computes line and column", () => {
    expect(lineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
});

describe("markdown", () => {
  it("parses common blocks", () => {
    const blocks = parseBlocks("# หัวข้อ\n\nย่อหน้า\nต่อ\n\n- a\n- [x] b\n\n1. one\n2. two\n\n> quote\n\n```js\nlet x = 1;\n```\n\n---");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "code", "rule"]);
    expect(blocks[1]).toEqual({ type: "paragraph", text: "ย่อหน้า ต่อ" });
    expect(blocks[2]).toMatchObject({ ordered: false, items: [{ text: "a", checked: null }, { text: "b", checked: true }] });
    expect(blocks[5]).toEqual({ type: "code", language: "js", code: "let x = 1;" });
  });

  it("renders inline formatting", () => {
    const { container } = render(<MarkdownView source={"**หนา** *เอียง* `code` [ลิงก์](https://example.com)"} />);
    expect(container.querySelector("strong")?.textContent).toBe("หนา");
    expect(container.querySelector("em")?.textContent).toBe("เอียง");
    expect(container.querySelector("code")?.textContent).toBe("code");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("never renders raw HTML or unsafe links", () => {
    const alert = vi.fn();
    window.alert = alert;
    const { container } = render(
      <MarkdownView source={'<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1)) [y](data:text/html,hi)'} />,
    );
    expect(container.querySelector("script, img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(alert).not.toHaveBeenCalled();
  });

  it("allows only http, https and mailto URLs", () => {
    expect(safeUrl("https://a.th/x")).toBe("https://a.th/x");
    expect(safeUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeUrl("/relative")).toBeNull();
  });
});

describe("text tools", () => {
  it("counts Thai text correctly", () => {
    const stats = textStats("สวัสดีครับ\nhello world");
    expect(stats.lines).toBe(2);
    expect(stats.words).toBeGreaterThanOrEqual(3);
    expect(textStats("น้ำ").characters).toBe(1); // one grapheme cluster, not 3 code points
    expect(textStats("").lines).toBe(0);
  });

  it("round-trips UTF-8 through Base64", () => {
    expect(encodeBase64("สวัสดี")).toBe("4Liq4Lin4Lix4Liq4LiU4Li1");
    expect(decodeBase64(encodeBase64("ทดสอบ 🎉"))).toBe("ทดสอบ 🎉");
    expect(applyTransform("%%%", "base64-decode").ok).toBe(false);
  });

  it("applies line and case transforms", () => {
    expect(applyTransform("b\na\nb\n\n", "dedupe-lines")).toEqual({ ok: true, output: "b\na\n" });
    expect(applyTransform("ข\nก", "sort-lines")).toEqual({ ok: true, output: "ก\nข" });
    expect(applyTransform("hello WORLD", "title")).toEqual({ ok: true, output: "Hello World" });
    expect(applyTransform("a\n\n b ", "remove-empty-lines")).toEqual({ ok: true, output: "a\n b " });
    expect(applyTransform("ก ข&", "url-encode")).toEqual({ ok: true, output: "%E0%B8%81%20%E0%B8%82%26" });
    expect(applyTransform("%E0%B8", "url-decode").ok).toBe(false);
  });
});

describe("uuid", () => {
  it("generates valid v4 UUIDs", () => {
    const id = uuidV4();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4");
  });

  it("generates the requested count with options and clamps", () => {
    const ids = generateUuids(5, { uppercase: true, hyphens: false });
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids[0]).toMatch(/^[0-9A-F]{32}$/);
    expect(generateUuids(0)).toHaveLength(1);
    expect(generateUuids(5000)).toHaveLength(1000);
  });

  it("validates UUIDs", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
});
