import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FAVORITES_KEY } from "../features/dashboard/favorites";
import { SETTINGS_KEY } from "../features/settings/settings";
import { renderApp } from "../test/renderApp";

describe("App", () => {
  it("renders the dashboard with the default pinned tools", async () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    for (const title of ["นาฬิกา", "เครื่องคิดเลข", "จับเวลา"]) {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
    // Lazy widgets finish loading.
    expect(await screen.findByLabelText("นิพจน์ที่ต้องการคำนวณ")).toBeInTheDocument();
  });

  it("unpins a tool, remembers it after reload, and shows the empty state", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await user.click(screen.getByRole("button", { name: "เลิกปักหมุด นาฬิกา" }));
    expect(screen.queryByRole("region", { name: "นาฬิกา" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "{}").ids).toEqual(["calculator", "timer"]);

    unmount();
    renderApp();
    expect(screen.queryByRole("region", { name: "นาฬิกา" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "เลิกปักหมุด เครื่องคิดเลข" }));
    await user.click(screen.getByRole("button", { name: "เลิกปักหมุด จับเวลา" }));
    expect(screen.getByText("ยังไม่มีเครื่องมือที่ปักหมุด")).toBeInTheDocument();
  });

  it("falls back to defaults when stored data is corrupted", () => {
    localStorage.setItem(FAVORITES_KEY, "{broken");
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, theme: 42 }));
    renderApp();
    expect(screen.getByRole("region", { name: "นาฬิกา" })).toBeInTheDocument();
    expect(screen.getByText("ข้อมูลที่บันทึกไว้เสียหาย ระบบจึงใช้ค่าเริ่มต้นแทน")).toBeInTheDocument();
  });

  it("ignores stored favorites that reference removed tools", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ version: 1, ids: ["old-tool", "timer"] }));
    renderApp();
    expect(screen.getByRole("region", { name: "จับเวลา" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "นาฬิกา" })).not.toBeInTheDocument();
  });

  it("searches tools by name and shows an empty result message", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole("searchbox", { name: "ค้นหาเครื่องมือ" });
    await user.type(search, "คิดเลข");
    expect(screen.getByRole("heading", { name: "ผลการค้นหา" })).toBeInTheDocument();
    const results = screen.getByRole("list");
    expect(within(results).getAllByRole("link")).toHaveLength(1);
    expect(within(results).getByRole("link", { name: /เครื่องคิดเลข/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("ไม่พบเครื่องมือ");

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

  it("opens a tool page from a direct link and handles unknown routes", async () => {
    renderApp("#/tools/calculator");
    expect(await screen.findByLabelText("นิพจน์ที่ต้องการคำนวณ")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "นาฬิกา" })).not.toBeInTheDocument();

    act(() => {
      window.location.hash = "#/tools/does-not-exist";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "ไม่พบหน้านี้" })).toBeInTheDocument();
  });

  it("changes the time format on the settings page", async () => {
    const user = userEvent.setup();
    renderApp("#/settings");
    await user.click(screen.getByRole("radio", { name: "12 ชั่วโมง" }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").timeFormat).toBe("12h");
  });
});
