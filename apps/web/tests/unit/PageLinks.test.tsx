import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspectResultView } from "@/features/inspect/InspectResultView";
import { makeJob, pageResult } from "./fixtures";
import { jsonResponse, mockFetch, renderWithI18n } from "./helpers";

describe("Page link grabber", () => {
  it("lists files found on a page with category filters", async () => {
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} />);
    expect(screen.getByText("Files found on this page (4)")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "Image (1)" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("https://site.example/b.jpg")).toBeInTheDocument();
  });

  it("does not let streams be selected", async () => {
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    const stream = screen.getByText("https://site.example/live.m3u8").closest("label")!;
    expect(within(stream).getByRole("checkbox")).toBeDisabled();
    expect(within(stream).getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Download selected (3)" })).toBeEnabled();
  });

  it("queues the selected links as one batch", async () => {
    const fetchMock = mockFetch(jsonResponse({ created: [makeJob(), makeJob()], errors: [] }, 202));
    const onQueued = vi.fn();
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} onQueued={onQueued} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /Report/ }));
    await user.click(screen.getByText("https://site.example/c.mp4"));
    await user.click(screen.getByRole("button", { name: "Download selected (2)" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/downloads/batch");
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { url: "https://site.example/a.pdf", mode: "direct" },
        { url: "https://site.example/c.mp4", mode: "direct" },
      ],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("2 added to the queue, 0 rejected.");
    expect(onQueued).toHaveBeenCalled();
  });
});
