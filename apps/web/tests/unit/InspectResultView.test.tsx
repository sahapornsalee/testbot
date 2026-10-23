import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspectResultView } from "@/features/inspect/InspectResultView";
import { fileResult, makeJob, mediaResult } from "./fixtures";
import { jsonResponse, mockFetch, renderWithI18n } from "./helpers";

describe("InspectResultView", () => {
  it("shows file metadata from the analysis", () => {
    renderWithI18n(<InspectResultView result={fileResult} onJobCreated={vi.fn()} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("Document")).toBeInTheDocument();
    expect(screen.getByText("1.46 MB")).toBeInTheDocument();
    expect(screen.getByText(/Server says: application\/octet-stream/)).toBeInTheDocument();
    expect(screen.getByText("https://cdn.example.com/report.pdf")).toBeInTheDocument();
  });

  it("creates a direct download job", async () => {
    const fetchMock = mockFetch(jsonResponse(makeJob({ status: "queued" }), 202));
    const onJobCreated = vi.fn();
    renderWithI18n(<InspectResultView result={fileResult} onJobCreated={onJobCreated} />);
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: fileResult.url, mode: "direct" });
    expect(onJobCreated).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Download added to the queue.");
  });

  it("shows no single-file download for web pages without files", () => {
    renderWithI18n(
      <InspectResultView result={{ ...fileResult, kind: "webpage", downloadable: false, warnings: ["WEBPAGE_NOT_FILE"] }} onJobCreated={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.getByText("This link is a web page, not a downloadable file.")).toBeInTheDocument();
    expect(screen.getByText("No downloadable files were found on this page.")).toBeInTheDocument();
  });

  it("lists only the real formats and pre-selects the best one", () => {
    renderWithI18n(<InspectResultView result={mediaResult} onJobCreated={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /1080p/ })).toBeChecked();
    expect(screen.queryByText(/2160p|4K/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Add the best audio track/)).toBeChecked();
  });

  it("sends the selected format and merge choice", async () => {
    const fetchMock = mockFetch(jsonResponse(makeJob({ mode: "media" }), 202), jsonResponse(makeJob({ mode: "media" }), 202));
    renderWithI18n(<InspectResultView result={mediaResult} onJobCreated={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      url: mediaResult.url,
      mode: "media",
      format_id: "137",
      merge_audio: true,
    });

    await user.click(screen.getByRole("radio", { name: /360p/ }));
    expect(screen.queryByLabelText(/Add the best audio track/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ format_id: "18", merge_audio: false });
  });

  it("explains when FFmpeg is missing", () => {
    const noFfmpeg = { ...mediaResult, media: { ...mediaResult.media!, ffmpeg_available: false } };
    renderWithI18n(<InspectResultView result={noFfmpeg} onJobCreated={vi.fn()} />);
    expect(screen.getByText(/FFmpeg is unavailable/)).toBeInTheDocument();
  });
});
