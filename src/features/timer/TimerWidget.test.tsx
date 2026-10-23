import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimerWidget from "./TimerWidget";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("TimerWidget", () => {
  it("runs, pauses, resumes and resets the stopwatch", () => {
    render(<TimerWidget />);
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม" }));
    advance(2_000);
    expect(screen.getByText("00:02.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "หยุด" }));
    advance(5_000);
    expect(screen.getByText("00:02.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ต่อ" }));
    advance(1_000);
    fireEvent.click(screen.getByRole("button", { name: "รอบ" }));
    expect(screen.getByRole("list", { name: "รอบที่บันทึก" })).toHaveTextContent("รอบ 1");

    fireEvent.click(screen.getByRole("button", { name: "รีเซ็ต" }));
    expect(screen.getByText("00:00.00")).toBeInTheDocument();
  });

  it("counts down and announces when time is up", () => {
    render(<TimerWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "นับถอยหลัง" }));
    fireEvent.change(screen.getByLabelText("นาที"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("วินาที"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม" }));
    advance(1_000);
    expect(screen.getByText("00:02")).toBeInTheDocument();
    advance(2_500);
    expect(screen.getByText("หมดเวลาแล้ว!")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("keeps an accurate countdown after a long background throttle", () => {
    render(<TimerWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "นับถอยหลัง" }));
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม" }));
    // Simulate the browser skipping timers: wall clock jumps 10 minutes.
    act(() => {
      vi.setSystemTime(Date.now() + 10 * 60_000);
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("หมดเวลาแล้ว!")).toBeInTheDocument();
  });

  it("does not start a countdown of zero seconds", () => {
    render(<TimerWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "นับถอยหลัง" }));
    fireEvent.change(screen.getByLabelText("นาที"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "เริ่ม" })).toBeDisabled();
    expect(screen.getByText("กรุณากำหนดเวลามากกว่า 0 วินาที")).toBeInTheDocument();
  });

  it("keeps the stopwatch running while viewing the countdown tab", () => {
    render(<TimerWidget />);
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม" }));
    fireEvent.click(screen.getByRole("tab", { name: "นับถอยหลัง" }));
    advance(3_000);
    fireEvent.click(screen.getByRole("tab", { name: "จับเวลา" }));
    advance(100);
    expect(screen.getByText("00:03.10")).toBeInTheDocument();
  });
});
