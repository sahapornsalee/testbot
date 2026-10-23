import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JobCard } from "@/features/jobs/JobCard";
import { makeJob } from "./fixtures";
import { renderWithI18n } from "./helpers";

describe("JobCard", () => {
  it("shows progress for a running job and can cancel it", async () => {
    const onCancel = vi.fn();
    renderWithI18n(<JobCard job={makeJob()} onCancel={onCancel} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("1 KB of 2 KB")).toBeInTheDocument();
    expect(screen.getByText("Downloading")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledWith(makeJob().id);
  });

  it("shows unknown totals honestly", () => {
    renderWithI18n(<JobCard job={makeJob({ expected_size: null, progress: null })} onCancel={vi.fn()} />);
    expect(screen.getByText("1 KB downloaded")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("shows a localized error for failed jobs", () => {
    renderWithI18n(
      <JobCard job={makeJob({ status: "failed", progress: null, error: { code: "FILE_TOO_LARGE", message: "x" } })} onCancel={vi.fn()} />,
      "th",
    );
    expect(screen.getByText("ล้มเหลว")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("ไฟล์มีขนาดใหญ่เกินกว่าที่กำหนด");
    expect(screen.queryByRole("button", { name: "ยกเลิก" })).not.toBeInTheDocument();
  });

  it("offers the file only when completed", () => {
    renderWithI18n(
      <JobCard job={makeJob({ status: "completed", progress: 1, download_available: true, actual_size: 2048 })} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Save file" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
