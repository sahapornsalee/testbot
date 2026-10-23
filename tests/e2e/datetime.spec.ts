import { expect, test } from "./fixtures";

// A device set to US English in New York: the app must still default to Thailand.
test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("defaults to Thai time and Thai dates regardless of the device", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T20:30:00Z")); // 03:30 on 24 Oct in Bangkok
  await page.goto("./#/tools/clock");
  await expect(page.locator(".clock-time")).toHaveText("03:30:00");
  await expect(page.locator(".clock-date")).toHaveText("วันเสาร์ที่ 24 ตุลาคม 2569");
  await expect(page.locator(".clock-zone")).toHaveText("กรุงเทพฯ · UTC+07:00");

  await page.goto("./#/tools/expenses");
  await expect(page.getByLabel("วันที่: ปี (พ.ศ.)")).toHaveValue("2569");
  await expect(page.getByLabel("วันที่: เดือน")).toHaveValue("10");
  await expect(page.getByLabel("วันที่: วัน")).toHaveValue("24");
});

test("can switch to England in settings", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T20:30:00Z")); // 21:30 BST in London
  await page.goto("./#/settings");
  await page.getByRole("radio", { name: "อังกฤษ UK (ค.ศ.)" }).check();
  await page.getByLabel("เขตเวลา").selectOption("Europe/London");

  await page.goto("./#/tools/clock");
  await expect(page.locator(".clock-time")).toHaveText("21:30:00");
  await expect(page.locator(".clock-date")).toHaveText(/^Friday,? 23 October 2026$/);
  await expect(page.locator(".clock-zone")).toHaveText("ลอนดอน · UTC+01:00");

  await page.reload();
  await page.goto("./#/tools/calendar");
  await expect(page.getByRole("heading", { name: /October 2026/ })).toBeVisible();
  await expect(page.getByLabel("ตั้งแต่วันที่: ปี")).toHaveValue("2026");
});
