import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Renders text into a PNG inside the browser and returns its bytes. */
async function textImage(page: Page, lines: string[]): Promise<Buffer> {
  const dataUrl = await page.evaluate((text) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 120 + text.length * 90;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(0, 0, canvas.width, 40);
    ctx.fillStyle = "#000000";
    ctx.font = "56px sans-serif";
    text.forEach((line, i) => ctx.fillText(line, 40, 120 + i * 90));
    return canvas.toDataURL("image/png");
  }, lines);
  return Buffer.from(dataUrl.split(",")[1] as string, "base64");
}

test("turns an image into text an AI chat can read, including OCR", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./#/tools/image-to-text");
  const png = await textImage(page, ["INVOICE 2026", "TOTAL 1500 BAHT"]);
  await page.getByLabel("เลือกรูปภาพ").setInputFiles({ name: "invoice.png", mimeType: "image/png", buffer: png });

  await expect(page.getByRole("img", { name: "รูปที่เลือก: invoice.png" })).toBeVisible();
  const output = page.getByRole("textbox", { name: "ข้อความสำหรับวางในแชท AI" });
  await expect(output).toHaveValue(/900 × 300 พิกเซล \(แนวนอน\)/);
  await expect(output).toHaveValue(/สีหลัก: ขาว #FFFFFF/);
  await expect(output).toHaveValue(/ภาพร่างด้วยตัวอักษร/);
  // OCR runs on our own copy of the engine; allow time for the first load.
  await expect(output).toHaveValue(/INVOICE 2026/, { timeout: 90_000 });
  await expect(output).toHaveValue(/TOTAL 1500 BAHT/);

  await page.getByLabel("คำถามถึง AI (ไม่บังคับ)").fill("ยอดรวมเท่าไร");
  await expect(output).toHaveValue(/## คำถาม\nยอดรวมเท่าไร$/);
});

test("rejects files that are not images", async ({ page }) => {
  await page.goto("./#/tools/image-to-text");
  await page.getByLabel("เลือกรูปภาพ").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await expect(page.getByRole("alert")).toHaveText("กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WebP, GIF)");
});

test("OCR keeps working offline after first use", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Service worker check runs on Chromium");
  test.setTimeout(180_000);
  await page.goto("./#/tools/image-to-text");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // First use online downloads and caches the OCR engine.
  await page.getByLabel("เลือกรูปภาพ").setInputFiles({ name: "a.png", mimeType: "image/png", buffer: await textImage(page, ["ONLINE FIRST"]) });
  await expect(page.getByRole("textbox", { name: "ข้อความสำหรับวางในแชท AI" })).toHaveValue(/ONLINE FIRST/, { timeout: 90_000 });

  // The engine sits in its own cache, which app updates do not clear.
  expect(await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("productivity-hub-ocr:")))).toHaveLength(1);

  await context.setOffline(true);
  await page.reload();
  await page.getByLabel("เลือกรูปภาพ").setInputFiles({ name: "b.png", mimeType: "image/png", buffer: await textImage(page, ["OFFLINE WORKS"]) });
  await expect(page.getByRole("textbox", { name: "ข้อความสำหรับวางในแชท AI" })).toHaveValue(/OFFLINE WORKS/, { timeout: 90_000 });
  await context.setOffline(false);
});
