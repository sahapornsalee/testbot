import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BatchForm, parseLinks } from "@/features/inspect/BatchForm";
import { makeJob } from "./fixtures";
import { jsonResponse, mockFetch, renderWithI18n } from "./helpers";

describe("BatchForm", () => {
  it("parses one link per line, ignoring blanks, max 50", () => {
    expect(parseLinks(" https://a/1 \n\n https://a/2\r\n")).toEqual(["https://a/1", "https://a/2"]);
    expect(parseLinks(Array.from({ length: 60 }, (_, i) => `https://a/${i}`).join("\n"))).toHaveLength(50);
  });

  it("queues all links and reports rejected lines in Thai", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        created: [makeJob()],
        errors: [{ index: 1, url: "http://10.0.0.1/x.zip", error: { code: "BLOCKED_DESTINATION", message: "x" } }],
      }, 202),
    );
    const onQueued = vi.fn();
    renderWithI18n(<BatchForm onQueued={onQueued} />, "th");
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("ลิงก์ (บรรทัดละ 1 ลิงก์)"));
    await user.paste("https://example.com/a.zip\nhttp://10.0.0.1/x.zip");
    await user.click(screen.getByRole("button", { name: "เพิ่ม 2 ลิงก์เข้าคิว" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).items).toHaveLength(2);
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("เพิ่มเข้าคิว 1 รายการ ถูกปฏิเสธ 1 รายการ");
    expect(status).toHaveTextContent("บรรทัด 2");
    expect(onQueued).toHaveBeenCalled();
  });

  it("asks for links when empty", async () => {
    const fetchMock = mockFetch();
    renderWithI18n(<BatchForm onQueued={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Add 0 links to queue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Paste at least one link.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
