import { expect, test } from "./fixtures";

test("calculator, converter and percentage give correct answers", async ({ page }) => {
  await page.goto("./#/tools/calculator");
  const expression = page.getByLabel("นิพจน์ที่ต้องการคำนวณ");
  await expression.fill("(2+3)*4-10%");
  await expression.press("Enter");
  await expect(expression).toHaveValue("19.9");

  await page.goto("./#/tools/converter");
  await page.getByLabel("ประเภท").selectOption("area");
  await page.getByLabel("ค่า").fill("1");
  await page.getByLabel("จาก").selectOption("rai");
  await page.getByLabel("เป็น").selectOption("sqwa");
  await expect(page.locator(".result-value")).toHaveText("400");

  await page.goto("./#/tools/percentage");
  await expect(page.locator(".result-value")).toHaveText("105");
});

test("calendar computes days between dates", async ({ page }) => {
  await page.goto("./#/tools/calendar");
  const setDate = async (label: string, day: string, month: string, beYear: string) => {
    await page.getByLabel(`${label}: ปี (พ.ศ.)`).fill(beYear);
    await page.getByLabel(`${label}: เดือน`).selectOption(month);
    await page.getByLabel(`${label}: วัน`).selectOption(day);
  };
  await setDate("ตั้งแต่วันที่", "1", "1", "2569");
  await setDate("ถึงวันที่", "31", "12", "2569");
  await expect(page.getByText("364 วัน", { exact: true })).toBeVisible();
});

test("timer keeps running across a reload", async ({ page }) => {
  await page.goto("./#/tools/timer");
  await page.getByRole("button", { name: "เริ่ม" }).first().click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("button", { name: "หยุด" })).toBeVisible();
  const text = await page.locator(".timer-display").first().textContent();
  expect(text && text >= "00:01").toBeTruthy();
});

test("developer tools work and markdown never runs scripts", async ({ page }) => {
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });

  await page.goto("./#/tools/json");
  await page.getByLabel("JSON ต้นฉบับ").fill('{"b":1,"a":2}');
  await page.getByRole("button", { name: "จัดรูปแบบ" }).click();
  await expect(page.getByLabel("ผลลัพธ์ JSON")).toHaveText('{\n  "b": 1,\n  "a": 2\n}');
  await page.getByLabel("JSON ต้นฉบับ").fill('{"a":}');
  await page.getByRole("button", { name: "จัดรูปแบบ" }).click();
  await expect(page.getByRole("alert")).toContainText("บรรทัด 1");

  await page.goto("./#/tools/markdown");
  await page.getByLabel("Markdown", { exact: true }).fill('# ทดสอบ\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1))');
  const preview = page.getByRole("region", { name: "ตัวอย่างผลลัพธ์" });
  await expect(preview.getByRole("heading", { name: "ทดสอบ" })).toBeVisible();
  await expect(preview.locator("img, a")).toHaveCount(0);
  expect(dialog).toBe(false);

  await page.goto("./#/tools/uuid");
  const ids = (await page.getByLabel("UUID ที่สร้าง").textContent())?.split("\n") ?? [];
  expect(ids).toHaveLength(5);

  await page.goto("./#/tools/text");
  await page.getByLabel("ข้อความ", { exact: true }).fill("สวัสดี");
  await page.getByLabel("แปลงข้อความ").selectOption("base64-encode");
  await page.getByRole("button", { name: "แปลง", exact: true }).click();
  await expect(page.getByLabel("ข้อความ", { exact: true })).toHaveValue("4Liq4Lin4Lix4Liq4LiU4Li1");
});
