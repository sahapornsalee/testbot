import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { columnIndex, officeToText, toMarkdownTable } from "./office";
import { createPrompt, fillTemplate, parsePrompts, placeholders, DEFAULT_PROMPTS } from "./prompts";
import { findPii, isValidThaiId, luhnValid, redact } from "./redact";
import { chunkText, splitForChat } from "./splitter";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

describe("office files", () => {
  it("reads Word paragraphs, headings, lists and tables", () => {
    const doc = `<?xml version="1.0"?><w:document ${W}><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>รายงานประจำเดือน</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">ยอดขาย </w:t></w:r><w:r><w:t>เพิ่มขึ้น</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>ข้อแรก</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>สินค้า</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>ราคา</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>ปากกา|ดำ</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    </w:body></w:document>`;
    const bytes = zipSync({ "word/document.xml": strToU8(doc) });
    expect(officeToText("docx", bytes)).toBe(
      "# รายงานประจำเดือน\nยอดขาย เพิ่มขึ้น\n- ข้อแรก\n\n| สินค้า | ราคา |\n| --- | --- |\n| ปากกา\\|ดำ | 10 |",
    );
  });

  it("reads Excel sheets with shared strings", () => {
    const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<workbook ${S}><sheets><sheet name="ยอดขาย" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
      "xl/sharedStrings.xml": strToU8(`<sst ${S}><si><t>เดือน</t></si><si><t>ยอด</t></si><si><r><t>ม.</t></r><r><t>ค.</t></r></si></sst>`),
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet ${S}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1500.5</v></c></row></sheetData></worksheet>`,
      ),
    });
    expect(officeToText("xlsx", bytes)).toBe("## ชีต: ยอดขาย\n| เดือน | ยอด |  |\n| --- | --- | --- |\n| ม.ค. |  | 1500.5 |");
  });

  it("reads PowerPoint slides in order", () => {
    const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    const slide = (t: string) => strToU8(`<p:sld ${P}><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`);
    const bytes = zipSync({ "ppt/slides/slide10.xml": slide("สิบ"), "ppt/slides/slide2.xml": slide("สอง") });
    expect(officeToText("pptx", bytes)).toBe("## สไลด์ 2\nสอง\n\n## สไลด์ 10\nสิบ");
  });

  it("rejects non-zip files with a helpful message", () => {
    expect(() => officeToText("docx", new Uint8Array([1, 2, 3]))).toThrow(/\.docx/);
  });

  it("helpers", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("AB12")).toBe(27);
    expect(toMarkdownTable([["a"], ["b", "c"]])).toBe("| a |  |\n| --- | --- |\n| b | c |");
  });
});

describe("splitter", () => {
  it("cuts at paragraph boundaries and keeps everything", () => {
    const text = Array.from({ length: 10 }, (_, i) => `ย่อหน้า ${i} ${"ก".repeat(80)}`).join("\n\n");
    const chunks = chunkText(text, 300);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
    expect(chunks.join("\n\n")).toBe(text);
  });

  it("hard-cuts text without any break", () => {
    expect(chunkText("ก".repeat(250), 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it("adds wait-then-answer instructions that fit the limit", () => {
    const parts = splitForChat("x ".repeat(3000), { maxChars: 2000, withInstructions: true, task: "สรุป" });
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= 2000)).toBe(true);
    expect(parts[0]).toContain(`ทั้งหมด ${parts.length} ส่วน`);
    expect(parts.at(-1)).toContain("ตอนนี้ช่วย: สรุป");
    expect(splitForChat("สั้น", { maxChars: 2000, withInstructions: true, task: "" })).toEqual(['สรุปเนื้อหาทั้งหมด\n\n"""\nสั้น\n"""']);
    expect(splitForChat("", { maxChars: 2000, withInstructions: false, task: "" })).toEqual([]);
  });
});

describe("redaction", () => {
  const all = new Set(["thai-id", "phone", "email", "card", "bank", "custom"] as const);

  it("validates Thai IDs and cards", () => {
    expect(isValidThaiId("1-1037-02071-83-8")).toBe(true);
    expect(isValidThaiId("1103702071832")).toBe(false);
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
    expect(luhnValid("4111 1111 1111 1112")).toBe(false);
  });

  it("masks personal data with labels", () => {
    const text = "คุณสมชาย เลขบัตร 1-1037-02071-83-8 โทร 081-234-5678 หรือ 02 123 4567 อีเมล som@example.co.th บัตร 4111-1111-1111-1111 โอนเข้าบัญชี 123-4-56789-0";
    const result = redact(text, { kinds: all, customWords: ["สมชาย"], style: "label" });
    expect(result.text).toBe(
      "คุณ[คำที่กำหนดเอง] เลขบัตร [เลขบัตรประชาชน] โทร [เบอร์โทร] หรือ [เบอร์โทร] อีเมล [อีเมล] บัตร [เลขบัตรเครดิต] โอนเข้าบัญชี [เลขบัญชี]",
    );
    expect(result.matches).toHaveLength(7);
  });

  it("leaves ordinary numbers alone and respects the chosen kinds", () => {
    const text = "ราคา 1,500.00 บาท วันที่ 23/10/2569 เลข 1103702071832 โทร 0812345678";
    expect(findPii(text, { kinds: all, customWords: [] }).map((m) => m.kind)).toEqual(["phone"]);
    expect(findPii(text, { kinds: new Set(["email"]), customWords: [] })).toEqual([]);
  });

  it("can block out matches", () => {
    expect(redact("โทร 0812345678", { kinds: all, customWords: [], style: "block" }).text).toBe("โทร ██████████");
  });
});

describe("prompt templates", () => {
  it("lists and fills placeholders", () => {
    const body = "เขียนถึง {{ ผู้รับ }} เรื่อง {{เรื่อง}} และ {{ผู้รับ}}";
    expect(placeholders(body)).toEqual(["ผู้รับ", "เรื่อง"]);
    expect(fillTemplate(body, { ผู้รับ: "หัวหน้า" })).toBe("เขียนถึง หัวหน้า เรื่อง {{เรื่อง}} และ หัวหน้า");
  });

  it("validates stored prompts and creates new ones", () => {
    expect(parsePrompts(DEFAULT_PROMPTS)).toEqual(DEFAULT_PROMPTS);
    expect(parsePrompts({ version: 1, prompts: [{ id: "a", title: " ", body: "x" }, { id: "b", title: "ok", body: "y" }] })?.prompts).toHaveLength(1);
    expect(createPrompt("  ", "x")).toBeNull();
    expect(createPrompt("ชื่อ", "เนื้อหา")?.title).toBe("ชื่อ");
  });
});
