import { test as base, expect, type Page } from "@playwright/test";

/** Fails a test on any uncaught page error or console error. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use(errors);
    expect(errors, "page errors").toEqual([]);
  },
});

export { expect };

export async function openMenuIfMobile(page: Page) {
  const menu = page.getByRole("button", { name: "เปิดเมนู" });
  if (await menu.isVisible()) await menu.click();
}
