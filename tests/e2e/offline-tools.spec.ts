import { expect, test } from "./fixtures";

test("expense tracker keeps entries after reload and summarises the month", async ({ page }) => {
  await page.goto("./#/tools/expenses");
  const amount = page.getByRole("textbox", { name: "จำนวนเงิน" });
  await page.getByRole("button", { name: "รายรับ", exact: true }).click();
  await amount.fill("20000");
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await page.getByRole("button", { name: "รายจ่าย", exact: true }).click();
  await page.getByRole("combobox", { name: "หมวดหมู่" }).selectOption("เดินทาง");
  await amount.fill("1,500");
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();

  await page.reload();
  await expect(page.getByRole("list", { name: "รายการในเดือนนี้" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator(".stat-grid dd").nth(2)).toHaveText("18,500.00");
  await expect(page.getByRole("region", { name: "รายจ่ายตามหมวดหมู่" })).toContainText("เดินทาง");
});

test("money helpers give correct answers", async ({ page }) => {
  await page.goto("./#/tools/baht-text");
  await page.getByLabel("จำนวนเงิน (บาท)").fill("1,000,001.25");
  await expect(page.locator(".baht-text")).toHaveText("หนึ่งล้านเอ็ดบาทยี่สิบห้าสตางค์");

  await page.goto("./#/tools/bill");
  await page.getByLabel("ยอดอาหาร (บาท)").fill("1000");
  await page.getByLabel("จำนวนคน").fill("4");
  await page.getByLabel("ปัดขึ้นเป็นบาทเต็ม").uncheck();
  await expect(page.getByRole("status")).toContainText("294.25");
});

test("habits, counters and emergency info persist", async ({ page }) => {
  await page.goto("./#/tools/habits");
  await page.getByLabel("นิสัยใหม่").fill("ดื่มน้ำ");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await page.getByRole("button", { name: /ดื่มน้ำ .* \(วันนี้\)/ }).click();
  await page.goto("./#/tools/counter");
  await page.getByRole("button", { name: "เพิ่ม ตัวนับ" }).click();
  await page.getByRole("button", { name: "เพิ่ม ตัวนับ" }).click();
  await page.goto("./#/tools/emergency");
  await expect(page.getByRole("link", { name: /1669/ })).toHaveAttribute("href", "tel:1669");
  await page.getByRole("button", { name: "กรอกข้อมูล" }).click();
  await page.getByLabel("กรุ๊ปเลือด").fill("O+");
  await page.getByLabel("เบอร์ผู้ติดต่อฉุกเฉิน").fill("081-234-5678");
  await page.getByRole("button", { name: "บันทึก" }).click();

  await page.reload();
  await expect(page.locator(".medical-card")).toContainText("O+");
  await expect(page.getByRole("link", { name: /โทรหา/ })).toHaveAttribute("href", "tel:0812345678");
  await page.goto("./#/tools/counter");
  await expect(page.locator(".counter-value").first()).toHaveText("2");
  await page.goto("./#/tools/habits");
  await expect(page.getByText(/ต่อเนื่อง 1 วัน/)).toBeVisible();
});

test("QR code, password and hash work", async ({ page }) => {
  await page.goto("./#/tools/qr");
  await expect(page.getByRole("img", { name: /QR Code/ })).toBeVisible();
  await page.getByRole("button", { name: "Wi-Fi" }).click();
  await expect(page.getByText("กรุณาใส่ชื่อ Wi-Fi")).toBeVisible();
  await page.getByLabel("ชื่อ Wi-Fi (SSID)").fill("บ้านฉัน");
  await expect(page.getByRole("img", { name: /Wi-Fi บ้านฉัน/ })).toBeVisible();

  await page.goto("./#/tools/password");
  const first = await page.locator(".password-output").textContent();
  await page.getByRole("button", { name: "สร้างใหม่" }).click();
  await expect(page.locator(".password-output")).not.toHaveText(first ?? "");
  expect(first).toHaveLength(16);

  await page.goto("./#/tools/hash");
  await page.getByLabel("ข้อความ").fill("abc");
  await expect(page.getByLabel("SHA-256 hash")).toHaveText("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("new tools open while offline", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  for (const [id, check] of [
    ["expenses", "เพิ่มรายการ"],
    ["emergency", "1669"],
    ["qr", "ดาวน์โหลด PNG"],
    ["pomodoro", "โฟกัส"],
    ["loan", "ผ่อนต่อเดือน"],
  ] as const) {
    await page.goto(`./#/tools/${id}`);
    await expect(page.getByText(check).first()).toBeVisible();
  }
  await context.setOffline(false);
});
