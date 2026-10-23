import { expect, test } from "@playwright/test";

const FIXTURE = "http://127.0.0.1:8765";

test("analyze a direct file, download it and save the result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel("Link (URL)").fill(`${FIXTURE}/image.png`);
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByText("Analysis result")).toBeVisible();
  await expect(page.getByText("image/png")).toBeVisible();
  await page.getByRole("button", { name: "Download", exact: true }).click();

  const card = page.getByTestId("job-card").first();
  await expect(card.getByText("Completed")).toBeVisible({ timeout: 15_000 });
  const downloadPromise = page.waitForEvent("download");
  await card.getByRole("button", { name: "Save file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("image.png");
});

test("blocked internal address shows a localized error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ไทย" }).click();
  await page.getByLabel("ลิงก์ (URL)").fill("http://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: "วิเคราะห์" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("ถูกบล็อกเพื่อความปลอดภัย");
});

test("cancel a running download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel("Link (URL)").fill(`${FIXTURE}/slow.bin`);
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const card = page.getByTestId("job-card").filter({ hasText: "slow.bin" }).first();
  await card.getByRole("button", { name: "Cancel" }).click();
  await expect(card.getByText("Cancelled")).toBeVisible({ timeout: 10_000 });
});

test("layout has no horizontal overflow and settings show server status", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText(/API version|เวอร์ชัน API/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.goto("/history");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("batch add links and pause/resume a download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByText("Add many links").click();
  await page.getByLabel("Links (one per line)").fill(`${FIXTURE}/report\n${FIXTURE}/slow-ranged.bin`);
  await page.getByRole("button", { name: "Add 2 links to queue" }).click();
  await expect(page.getByText("2 added to the queue, 0 rejected.")).toBeVisible();

  const report = page.getByTestId("job-card").filter({ hasText: "report.pdf" }).first();
  await expect(report.getByText("Completed")).toBeVisible({ timeout: 15_000 });

  const slow = page.getByTestId("job-card").filter({ hasText: "slow-ranged.bin" }).first();
  await slow.getByRole("button", { name: "Pause" }).click();
  await expect(slow.getByText("Paused")).toBeVisible({ timeout: 10_000 });
  await slow.getByRole("button", { name: "Resume" }).click();
  await expect(slow.getByText("Completed")).toBeVisible({ timeout: 30_000 });
});

test("grab files from a web page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByLabel("Link (URL)").fill(`${FIXTURE}/gallery.html`);
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByText(/Files found on this page \(\d+\)/)).toBeVisible();
  await expect(page.getByText("Annual report")).toBeVisible();
  await page.getByRole("checkbox", { name: /Annual report/ }).check();
  await page.getByRole("button", { name: "Download selected (1)" }).click();
  await expect(page.getByText("1 added to the queue, 0 rejected.")).toBeVisible();
});
