import { zipSync, strToU8 } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { expect, test } from "./fixtures";

async function makePdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const line of lines) doc.addPage([300, 200]).drawText(line, { x: 20, y: 150, size: 14, font });
  return Buffer.from(await doc.save());
}

function makeDocx(paragraphs: string[]): Buffer {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("");
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
    }),
  );
}

test("file to text reads PDF and Word files", async ({ page }) => {
  await page.goto("./#/tools/file-to-text");
  const input = page.getByLabel("เลือกไฟล์เอกสาร");
  await input.setInputFiles({ name: "report.pdf", mimeType: "application/pdf", buffer: await makePdf(["First page hello", "Second page world"]) });
  const output = page.getByRole("textbox", { name: "ข้อความจากไฟล์" });
  await expect(output).toHaveValue(/First page hello[\s\S]*Second page world/, { timeout: 20_000 });

  await input.setInputFiles({ name: "memo.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: makeDocx(["สวัสดีครับ", "บรรทัดที่สอง"]) });
  await expect(output).toHaveValue(/สวัสดีครับ\s+บรรทัดที่สอง/);
});

test("splitter and redact prepare text for AI", async ({ page }) => {
  await page.goto("./#/tools/text-splitter");
  await page.getByLabel("ข้อความยาว", { exact: true }).fill("ก".repeat(5000));
  await page.getByLabel("ความยาวสูงสุดต่อข้อความ").selectOption("2000");
  const parts = page.getByRole("list", { name: "ส่วนที่แบ่งแล้ว" }).getByRole("listitem");
  expect(await parts.count()).toBeGreaterThanOrEqual(3);

  await page.goto("./#/tools/redact");
  await page.getByLabel("ข้อความต้นฉบับ").fill("ติดต่อ 081-234-5678 อีเมล somchai@example.com บัตร 1-1037-02071-83-8");
  const out = page.getByRole("textbox", { name: "ข้อความที่ปิดข้อมูลแล้ว" });
  await expect(out).not.toHaveValue(/081-234-5678|somchai@example\.com|02071/);
});

test("Thai tools: PromptPay QR, ID check, tax and holidays on the calendar", async ({ page }) => {
  await page.goto("./#/tools/promptpay");
  await page.getByLabel(/เบอร์มือถือ \/ เลขบัตรประชาชน/).fill("0812345678");
  await page.getByLabel("จำนวนเงิน (ไม่บังคับ)").fill("150.50");
  await expect(page.getByRole("img", { name: "QR พร้อมเพย์" })).toBeVisible();
  await expect(page.locator(".qr-box")).toContainText("150.50 บาท");

  await page.goto("./#/tools/tax");
  await page.getByLabel("เงินเดือน+โบนัสทั้งปี (บาท)").fill("600000");
  await page.getByLabel("เงินสมทบประกันสังคมที่จ่ายจริง").fill("9000");
  await expect(page.locator(".stat-grid dd").nth(1)).toHaveText("20,600.00");

  await page.goto("./#/tools/calendar");
  await expect(page.locator(".calendar-day.is-holiday").first()).toBeVisible();
});

test("PDF tools merge files and download the result", async ({ page }) => {
  await page.goto("./#/tools/pdf-tools");
  await page.getByLabel("เลือกไฟล์ PDF").setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: await makePdf(["A"]) },
    { name: "b.pdf", mimeType: "application/pdf", buffer: await makePdf(["B1", "B2"]) },
  ]);
  await expect(page.getByRole("list", { name: "ไฟล์ที่เลือก" }).getByRole("listitem")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "รวม 2 ไฟล์" }).click();
  const file = await download;
  const merged = await PDFDocument.load(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c)));
  expect(merged.getPageCount()).toBe(3);
});

test("kanban cards move and persist", async ({ page }) => {
  await page.goto("./#/tools/kanban");
  await page.getByLabel("งานใหม่").fill("เขียนรายงาน");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await page.getByRole("button", { name: "ย้าย “เขียนรายงาน” ไปช่องขวา" }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: /กำลังทำ/ })).toContainText("เขียนรายงาน");
});

test("vault encrypts notes and needs the password", async ({ page }) => {
  await page.goto("./#/tools/vault");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("correct-horse-1");
  await page.getByLabel("ยืนยันรหัสผ่าน").fill("correct-horse-1");
  await page.getByRole("button", { name: "สร้างและเข้ารหัส" }).click();
  await page.getByRole("button", { name: "รายการใหม่" }).click();
  await page.getByLabel("ชื่อรายการ").fill("Wi-Fi");
  await page.getByLabel("ข้อมูลลับ", { exact: true }).fill("super-secret-value");
  await expect(page.getByRole("status")).toHaveText("บันทึกแบบเข้ารหัสแล้ว", { timeout: 10_000 });
  const stored = await page.evaluate(() => localStorage.getItem("productivity-hub:vault") ?? "");
  expect(stored).not.toContain("super-secret-value");

  await page.reload();
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "ปลดล็อก" }).click();
  await expect(page.getByRole("alert")).toHaveText("รหัสผ่านไม่ถูกต้อง", { timeout: 10_000 });
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("correct-horse-1");
  await page.getByRole("button", { name: "ปลดล็อก" }).click();
  await expect(page.getByLabel("ข้อมูลลับ", { exact: true })).toHaveValue("super-secret-value", { timeout: 10_000 });
});

test("a due reminder alerts on any page", async ({ page }) => {
  await page.goto("./#/tools/notes");
  await page.evaluate(() => {
    const at = Date.now() - 1000;
    localStorage.setItem("productivity-hub:reminders", JSON.stringify({ version: 1, reminders: [{ id: "r1", title: "กินยา", at, done: false, notified: false, createdAt: at }] }));
  });
  await page.reload();
  const toast = page.getByRole("alertdialog", { name: "เตือนความจำ" });
  await expect(toast).toContainText("กินยา");
  await toast.getByRole("button", { name: "เสร็จแล้ว" }).click();
  await expect(toast).toBeHidden();
});

test("every tool page opens without errors", async ({ page }) => {
  const ids = ["file-to-text", "text-splitter", "redact", "prompts", "image-tools", "pdf-tools", "signature", "promptpay", "thai-id", "tax", "holidays", "kanban", "reminders", "vault"];
  for (const id of ids) {
    await page.goto(`./#/tools/${id}`);
    await expect(page.locator(".widget-body")).toBeVisible();
    await expect(page.locator(".widget-body")).not.toContainText("กำลังโหลด…");
    await expect(page.getByText("เกิดข้อผิดพลาด")).toHaveCount(0);
  }
});
