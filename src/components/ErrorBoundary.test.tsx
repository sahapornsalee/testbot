import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("contains a crashing widget and keeps siblings rendered", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <ErrorBoundary label="วิดเจ็ตทดสอบ">
          <Broken />
        </ErrorBoundary>
        <p>ส่วนอื่นยังอยู่</p>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("วิดเจ็ตทดสอบ เกิดข้อผิดพลาด");
    expect(screen.getByText("ส่วนอื่นยังอยู่")).toBeInTheDocument();
    spy.mockRestore();
  });
});
