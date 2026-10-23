import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UrlForm } from "@/features/inspect/UrlForm";
import { fileResult } from "./fixtures";
import { jsonResponse, mockFetch, renderWithI18n } from "./helpers";

describe("UrlForm", () => {
  it("sends the pasted URL to the inspect API", async () => {
    const fetchMock = mockFetch(jsonResponse(fileResult));
    const onResult = vi.fn();
    renderWithI18n(<UrlForm onResult={onResult} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Link (URL)"));
    await user.paste("  https://files.example.com/report.pdf ");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/inspect");
    expect(JSON.parse(init.body)).toEqual({ url: "https://files.example.com/report.pdf" });
    expect(new Headers(init.headers).get("X-UD-Client")).toBe("web");
    expect(onResult).toHaveBeenLastCalledWith(fileResult);
  });

  it("asks for a URL when empty", async () => {
    const fetchMock = mockFetch();
    renderWithI18n(<UrlForm onResult={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please paste a link first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a localized API error", async () => {
    mockFetch(jsonResponse({ error: { code: "BLOCKED_DESTINATION", message: "blocked" } }, 403));
    renderWithI18n(<UrlForm onResult={vi.fn()} />, "th");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("ลิงก์ (URL)"), "http://127.0.0.1/");
    await user.click(screen.getByRole("button", { name: "วิเคราะห์" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ถูกบล็อกเพื่อความปลอดภัย");
  });

  it("reports network failures", async () => {
    mockFetch(new TypeError("failed"));
    renderWithI18n(<UrlForm onResult={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Link (URL)"), "https://example.com/a.zip");
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the API server");
  });
});
