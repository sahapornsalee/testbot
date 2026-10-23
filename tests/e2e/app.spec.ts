import { expect, openMenuIfMobile, test } from "./fixtures";

test("loads the dashboard with all assets and no horizontal overflow", async ({ page, errors }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByLabel("นิพจน์ที่ต้องการคำนวณ")).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "./manifest.webmanifest");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test("cards in the same dashboard row have equal height", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("นิพจน์ที่ต้องการคำนวณ")).toBeVisible();
  const boxes = await page.locator(".dashboard-grid > .widget").evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: Math.round(rect.top), height: Math.round(rect.height) };
    }),
  );
  const rows = new Map<number, number[]>();
  for (const box of boxes) rows.set(box.top, [...(rows.get(box.top) ?? []), box.height]);
  for (const heights of rows.values()) expect(new Set(heights).size).toBe(1);
});

test("navigates with the menu and supports direct links and refresh", async ({ page }) => {
  await page.goto("./");
  await openMenuIfMobile(page);
  await page.getByRole("navigation").getByRole("link", { name: "JSON Formatter" }).click();
  await expect(page).toHaveURL(/#\/tools\/json$/);
  await page.reload();
  await expect(page.getByLabel("JSON ต้นฉบับ")).toBeVisible();
  await page.goto("./#/tools/does-not-exist");
  await expect(page.getByRole("heading", { name: "ไม่พบหน้านี้" })).toBeVisible();
});

test("customizes the dashboard and keeps the layout after reload", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "ปรับแต่ง" }).click();
  await page.getByRole("button", { name: "ย้าย นาฬิกา ไปถัดไป" }).click();
  await page.getByRole("button", { name: "ซ่อน บันทึก" }).click();
  await page.getByRole("button", { name: "เพิ่ม แปลงหน่วย" }).click();
  await page.getByRole("button", { name: "เสร็จสิ้น" }).click();

  await page.reload();
  const titles = page.locator(".dashboard-grid .widget-title");
  await expect(titles.first()).toHaveText("รายการงาน");
  await expect(titles.nth(1)).toHaveText("นาฬิกา");
  await expect(page.getByRole("region", { name: "บันทึก" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "แปลงหน่วย" })).toBeVisible();
});

test("reorders widgets with drag and drop on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "Drag and drop is a desktop enhancement; buttons cover touch and keyboard.");
  await page.goto("./");
  await page.getByRole("button", { name: "ปรับแต่ง" }).click();
  await page.locator('[data-widget-id="timer"]').dragTo(page.locator('[data-widget-id="clock"]'));
  await expect(page.locator(".dashboard-grid .widget-title").first()).toHaveText("จับเวลา");
});

test("keeps tasks and notes after reload", async ({ page }) => {
  await page.goto("./#/tools/tasks");
  const input = page.getByPlaceholder("เพิ่มงานใหม่…");
  await input.fill("ซื้อนม");
  await input.press("Enter");
  await input.fill("ส่งรายงาน");
  await input.press("Enter");
  await page.getByRole("checkbox", { name: "ซื้อนม" }).check();

  await page.goto("./#/tools/notes");
  await page.getByRole("button", { name: "ใหม่" }).click();
  await page.getByRole("textbox", { name: "ชื่อบันทึก" }).fill("ไอเดีย");
  await page.getByRole("textbox", { name: "เนื้อหาบันทึก" }).fill("ทำแอปจับเวลา");
  await expect(page.getByText("บันทึกอัตโนมัติแล้ว")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /ไอเดีย/ })).toBeVisible();
  await page.goto("./#/tools/tasks");
  await expect(page.getByRole("checkbox", { name: "ซื้อนม" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "ส่งรายงาน" })).not.toBeChecked();
});

test("exports a backup and imports it into a fresh browser", async ({ page, browser }) => {
  await page.goto("./#/tools/tasks");
  const input = page.getByPlaceholder("เพิ่มงานใหม่…");
  await input.fill("งานสำรอง");
  await input.press("Enter");
  await expect(page.getByRole("checkbox", { name: "งานสำรอง" })).toBeVisible();

  await page.goto("./#/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "สำรองข้อมูล (ส่งออก)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^productivity-hub-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = test.info().outputPath(download.suggestedFilename());
  await download.saveAs(path);

  const fresh = await browser.newContext({ baseURL: page.url().split("#")[0] });
  const other = await fresh.newPage();
  await other.goto("./#/settings");
  await other.getByLabel("เลือกไฟล์สำรองข้อมูล").setInputFiles(path);
  await expect(other.getByText(/ไฟล์นี้มีงาน 1 รายการ/)).toBeVisible();
  await other.getByRole("button", { name: "แทนที่ด้วยข้อมูลจากไฟล์" }).click();
  await other.waitForLoadState("load");
  await other.goto("./#/tools/tasks");
  await expect(other.getByRole("checkbox", { name: "งานสำรอง" })).toBeVisible();
  await fresh.close();
});

test("rejects an invalid import file", async ({ page }) => {
  await page.goto("./#/settings");
  await page.getByLabel("เลือกไฟล์สำรองข้อมูล").setInputFiles({
    name: "evil.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ app: "other", tasks: ["<script>alert(1)</script>"] })),
  });
  await expect(page.getByRole("alert")).toHaveText("ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Productivity Hub");
});

test("keyboard users can skip to content and see focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "Hardware keyboard flow");
  await page.goto("./");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" });
  await expect(skip).toBeFocused();
  const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("works offline after the first visit", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Service worker check runs on Chromium");
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload so the page is controlled by the service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/ออฟไลน์อยู่/)).toBeVisible();
  await page.goto("./#/tools/markdown");
  await expect(page.getByRole("region", { name: "ตัวอย่างผลลัพธ์" })).toBeVisible();
  await context.setOffline(false);
});
