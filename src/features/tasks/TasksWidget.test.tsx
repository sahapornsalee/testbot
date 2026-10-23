import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { taskRepository } from "../../data/models";
import TasksWidget from "./TasksWidget";

afterEach(async () => {
  await taskRepository.replaceAll([]);
});

const list = () => screen.getByRole("list", { name: "รายการงาน" });
const titles = () => within(list()).getAllByRole("listitem").map((li) => li.textContent);

describe("TasksWidget", () => {
  it("adds, completes, edits, reorders and deletes tasks, persisting each change", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TasksWidget />);
    const input = await screen.findByPlaceholderText("เพิ่มงานใหม่…");
    expect(screen.getByText("ยังไม่มีงาน เริ่มเพิ่มงานแรกได้เลย")).toBeInTheDocument();

    await user.type(input, "ซื้อนม{Enter}");
    await user.type(input, "จ่ายค่าไฟ{Enter}");
    expect(titles()).toEqual(["ซื้อนม", "จ่ายค่าไฟ"]);

    await user.click(screen.getByRole("button", { name: 'เลื่อน "จ่ายค่าไฟ" ขึ้น' }));
    expect(titles()).toEqual(["จ่ายค่าไฟ", "ซื้อนม"]);

    await user.click(screen.getByRole("checkbox", { name: "ซื้อนม" }));
    expect(screen.getByText("ค้าง 1 · เสร็จ 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: 'แก้ไข "จ่ายค่าไฟ"' }));
    const editor = screen.getByRole("textbox", { name: "แก้ไขชื่องาน" });
    await user.clear(editor);
    await user.type(editor, "จ่ายค่าไฟเดือนนี้{Enter}");
    expect(titles()).toEqual(["จ่ายค่าไฟเดือนนี้", "ซื้อนม"]);

    await waitFor(async () => expect((await taskRepository.getAll()).items).toHaveLength(2));
    unmount();
    render(<TasksWidget />);
    await screen.findByRole("list", { name: "รายการงาน" });
    expect(titles()).toEqual(["จ่ายค่าไฟเดือนนี้", "ซื้อนม"]);
    expect(screen.getByRole("checkbox", { name: "ซื้อนม" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "เสร็จแล้ว" }));
    expect(titles()).toEqual(["ซื้อนม"]);
    await user.click(screen.getByRole("button", { name: "ทั้งหมด" }));

    await user.click(screen.getByRole("button", { name: 'ลบ "จ่ายค่าไฟเดือนนี้"' }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "ล้างงานที่เสร็จแล้ว" }));
    expect(screen.getByText("ยังไม่มีงาน เริ่มเพิ่มงานแรกได้เลย")).toBeInTheDocument();
    await waitFor(async () => expect((await taskRepository.getAll()).items).toHaveLength(0));
  });

  it("rejects empty titles", async () => {
    const user = userEvent.setup();
    render(<TasksWidget />);
    await user.type(await screen.findByPlaceholderText("เพิ่มงานใหม่…"), "   {Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("กรุณาพิมพ์ชื่องาน");
  });
});
