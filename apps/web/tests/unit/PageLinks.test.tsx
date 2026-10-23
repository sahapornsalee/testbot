import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspectResultView } from "@/features/inspect/InspectResultView";
import { itemRequest } from "@/features/inspect/PageLinks";
import { makeJob, pageResult } from "./fixtures";
import { jsonResponse, mockFetch, renderWithI18n } from "./helpers";

function row(url: string) {
  return within(screen.getByText(url).closest("label")!).getByRole("checkbox");
}

describe("Page link grabber", () => {
  it("lists everything found on a page with category filters", async () => {
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} />);
    expect(screen.getByText("Files found on this page (7)")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(8); // 7 items + "save this page"
    await userEvent.click(screen.getByRole("button", { name: "Image (1)" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("https://site.example/b.jpg")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Embedded videos (1)" }));
    expect(screen.getByText("https://www.youtube.com/embed/xyz")).toBeInTheDocument();
  });

  it("select all takes every downloadable file but not plain links or DASH", async () => {
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(row("https://site.example/live.m3u8")).toBeChecked();
    expect(row("https://www.youtube.com/embed/xyz")).toBeChecked();
    expect(row("https://site.example/dash.mpd")).toBeDisabled();
    expect(row("https://site.example/about")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Download selected (5)" })).toBeEnabled();
  });

  it("queues each item with the right downloader, plus the page itself", async () => {
    const fetchMock = mockFetch(jsonResponse({ created: [makeJob(), makeJob(), makeJob(), makeJob()], errors: [] }, 202));
    const onQueued = vi.fn();
    renderWithI18n(<InspectResultView result={pageResult} onJobCreated={vi.fn()} onQueued={onQueued} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /Save this page/ }));
    await user.click(row("https://site.example/a.pdf"));
    await user.click(row("https://site.example/live.m3u8"));
    await user.click(row("https://www.youtube.com/embed/xyz"));
    await user.click(screen.getByRole("button", { name: "Download selected (4)" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/downloads/batch");
    expect(JSON.parse(init.body).items).toEqual([
      { url: "https://site.example/gallery", mode: "page" },
      { url: "https://site.example/a.pdf", mode: "direct" },
      { url: "https://site.example/live.m3u8", mode: "hls", format_id: "best" },
      { url: "https://www.youtube.com/embed/xyz", mode: "media", format_id: "best", merge_audio: true },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("4 added to the queue, 0 rejected.");
    expect(onQueued).toHaveBeenCalled();
  });

  it("splits large selections into batches of 50", async () => {
    const links = Array.from({ length: 120 }, (_, i) => ({
      url: `https://site.example/img${i}.jpg`, category: "image" as const, extension: "jpg", source: "img", label: null,
    }));
    const batch = (n: number) => jsonResponse({ created: Array.from({ length: n }, () => makeJob()), errors: [] }, 202);
    const fetchMock = mockFetch(batch(50), batch(50), batch(20));
    renderWithI18n(<InspectResultView result={{ ...pageResult, links }} onJobCreated={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: "Download selected (120)" }));
    expect(await screen.findByRole("status")).toHaveTextContent("120 added to the queue, 0 rejected.");
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).items.length)).toEqual([50, 50, 20]);
  });

  it("maps categories to downloaders", () => {
    expect(itemRequest({ url: "https://a/x.mpd", category: "stream", extension: "mpd", source: "a", label: null })).toBeNull();
    expect(itemRequest({ url: "https://a/x.zip", category: "archive", extension: "zip", source: "a", label: null })).toEqual({
      url: "https://a/x.zip",
      mode: "direct",
    });
  });
});
