import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noteRepository } from "../../data/models";
import { SettingsProvider } from "../settings/SettingsContext";
import NotesWidget from "./NotesWidget";

const renderNotes = () =>
  render(
    <SettingsProvider>
      <NotesWidget />
    </SettingsProvider>,
  );

afterEach(async () => {
  await noteRepository.replaceAll([]);
});

describe("NotesWidget", () => {
  it("creates a note, autosaves it, finds it by search, and deletes it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderNotes();
    await user.click(await screen.findByRole("button", { name: "ใหม่" }));
    await user.type(screen.getByRole("textbox", { name: "ชื่อบันทึก" }), "ประชุมทีม");
    await user.type(screen.getByRole("textbox", { name: "เนื้อหาบันทึก" }), "สรุปงานไตรมาส");

    await waitFor(
      async () => {
        const { items } = await noteRepository.getAll();
        expect(items[0]).toMatchObject({ title: "ประชุมทีม", body: "สรุปงานไตรมาส" });
      },
      { timeout: 2000 },
    );
    expect(screen.getByText("บันทึกอัตโนมัติแล้ว")).toBeInTheDocument();

    unmount();
    renderNotes();
    await user.type(await screen.findByRole("searchbox", { name: "ค้นหาบันทึก" }), "ไตรมาส");
    await user.click(screen.getByRole("button", { name: /ประชุมทีม/ }));
    expect(screen.getByRole("textbox", { name: "เนื้อหาบันทึก" })).toHaveValue("สรุปงานไตรมาส");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "ลบบันทึกนี้" }));
    expect(screen.getByText("ยังไม่มีบันทึก กด “ใหม่” เพื่อเริ่มจด")).toBeInTheDocument();
  });

  it("saves pending edits when switching away before the autosave delay", async () => {
    const user = userEvent.setup();
    const { unmount } = renderNotes();
    await user.click(await screen.findByRole("button", { name: "ใหม่" }));
    await user.type(screen.getByRole("textbox", { name: "เนื้อหาบันทึก" }), "ด่วน");
    unmount();
    await waitFor(async () => expect((await noteRepository.getAll()).items[0]?.body).toBe("ด่วน"));
  });
});
