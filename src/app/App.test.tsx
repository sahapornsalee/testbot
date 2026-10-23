import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LAYOUT_KEY, LEGACY_FAVORITES_KEY } from "../features/dashboard/layout";
import { SETTINGS_KEY } from "../features/settings/settings";
import { renderApp } from "../test/renderApp";
import { WIDGETS } from "./registry";

const storedLayout = () => JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}");
const region = (name: string) => screen.queryByRole("region", { name });

describe("App", () => {
  it("renders the dashboard with the default tools", async () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    for (const title of ["นาฬิกา", "รายการงาน", "เครื่องคิดเลข", "จับเวลา", "บันทึก"]) {
      expect(region(title)).toBeInTheDocument();
    }
    expect(await screen.findByLabelText("นิพจน์ที่ต้องการคำนวณ")).toBeInTheDocument();
    expect(await screen.findByPlaceholderText("เพิ่มงานใหม่…")).toBeInTheDocument();
  });

  it("removes a tool with the star, remembers it after reload, and can pin it again", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await user.click(screen.getByRole("button", { name: "นำ นาฬิกา ออกจาก Dashboard" }));
    expect(region("นาฬิกา")).not.toBeInTheDocument();
    expect(storedLayout().items.map((i: { id: string }) => i.id)).not.toContain("clock");

    unmount();
    renderApp();
    expect(region("นาฬิกา")).not.toBeInTheDocument();
    const others = screen.getByRole("region", { name: "เครื่องมืออื่น" });
    expect(within(others).getByRole("link", { name: /นาฬิกา/ })).toBeInTheDocument();
  });

  it("migrates v0.1.0 favorites into the new layout", () => {
    localStorage.setItem(LEGACY_FAVORITES_KEY, JSON.stringify({ version: 1, ids: ["timer", "removed-tool"] }));
    renderApp();
    expect(region("จับเวลา")).toBeInTheDocument();
    expect(region("นาฬิกา")).not.toBeInTheDocument();
  });

  it("falls back to defaults when stored data is corrupted", () => {
    localStorage.setItem(LAYOUT_KEY, "{broken");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, theme: 42 }));
    renderApp();
    expect(region("นาฬิกา")).toBeInTheDocument();
    expect(screen.getByText("ข้อมูลที่บันทึกไว้เสียหาย ระบบจึงใช้ค่าเริ่มต้นแทน")).toBeInTheDocument();
  });

  it("customizes the dashboard in edit mode", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "ปรับแต่ง" }));

    // Move the clock after the task list with the keyboard-accessible button.
    await user.click(screen.getByRole("button", { name: "ย้าย นาฬิกา ไปถัดไป" }));
    expect(storedLayout().items.slice(0, 2).map((i: { id: string }) => i.id)).toEqual(["tasks", "clock"]);

    // Resize, hide and add.
    await user.selectOptions(screen.getByLabelText("ขนาดของ จับเวลา"), "large");
    await user.click(screen.getByRole("button", { name: "ซ่อน บันทึก" }));
    await user.click(screen.getByRole("button", { name: "เพิ่ม ปฏิทิน" }));
    await user.selectOptions(screen.getByLabelText("จำนวนคอลัมน์"), "2");

    const layout = storedLayout();
    expect(layout.columns).toBe(2);
    expect(layout.items.find((i: { id: string }) => i.id === "timer").size).toBe("large");
    expect(layout.items.find((i: { id: string }) => i.id === "notes").hidden).toBe(true);
    expect(layout.items.at(-1).id).toBe("calendar");

    await user.click(screen.getByRole("button", { name: "เสร็จสิ้น" }));
    expect(region("บันทึก")).not.toBeInTheDocument();
    expect(region("ปฏิทิน")).toBeInTheDocument();
  });

  it("searches tools by name and shows an empty result message", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole("searchbox", { name: "ค้นหาเครื่องมือ" });
    await user.type(search, "json");
    expect(screen.getByRole("heading", { name: "ผลการค้นหา" })).toBeInTheDocument();
    const results = screen.getByRole("list");
    expect(within(results).getAllByRole("link")).toHaveLength(1);
    expect(within(results).getByRole("link", { name: /JSON Formatter/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText(/ไม่พบเครื่องมือ/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("cycles the theme and applies it to the document", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /ธีมตามระบบ/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /ธีมสว่าง/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").theme).toBe("dark");
  });

  it("opens every tool page from a direct link without crashing", async () => {
    renderApp("#/tools/calculator");
    expect(await screen.findByLabelText("นิพจน์ที่ต้องการคำนวณ")).toBeInTheDocument();
    for (const { id } of WIDGETS) {
      act(() => {
        window.location.hash = `#/tools/${id}`;
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      const frame = await screen.findByRole("region");
      await within(frame).findByText((_, el) => el?.classList.contains("widget-body") === true && !el.textContent?.includes("กำลังโหลด…"));
      expect(screen.queryByText(/เกิดข้อผิดพลาด ส่วนอื่นของหน้า/)).toBeNull();
    }
    act(() => {
      window.location.hash = "#/tools/does-not-exist";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "ไม่พบหน้านี้" })).toBeInTheDocument();
  }, 60_000);

  it("changes the time format on the settings page", async () => {
    const user = userEvent.setup();
    renderApp("#/settings");
    await user.click(screen.getByRole("radio", { name: "12 ชั่วโมง" }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").timeFormat).toBe("12h");
  });
});
