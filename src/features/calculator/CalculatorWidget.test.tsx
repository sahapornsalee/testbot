import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CalculatorWidget from "./CalculatorWidget";

describe("CalculatorWidget", () => {
  it("calculates with the keypad", async () => {
    const user = userEvent.setup();
    render(<CalculatorWidget />);
    for (const name of ["1", "2", "บวก", "3", "คูณ", "2"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: "เท่ากับ" }));
    expect(screen.getByLabelText("นิพจน์ที่ต้องการคำนวณ")).toHaveValue("18");
    expect(screen.getByRole("region", { name: "ประวัติการคำนวณ" })).toHaveTextContent("12+3×2 = 18");
  });

  it("calculates from typed input with Enter", async () => {
    const user = userEvent.setup();
    render(<CalculatorWidget />);
    await user.type(screen.getByLabelText("นิพจน์ที่ต้องการคำนวณ"), "1500 * 7%{Enter}");
    expect(screen.getByLabelText("นิพจน์ที่ต้องการคำนวณ")).toHaveValue("105");
  });

  it("shows an error for division by zero and clears it when editing", async () => {
    const user = userEvent.setup();
    render(<CalculatorWidget />);
    const input = screen.getByLabelText("นิพจน์ที่ต้องการคำนวณ");
    await user.type(input, "8/0{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("หารด้วยศูนย์ไม่ได้");
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "ลบตัวสุดท้าย" }));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    expect(input).toHaveValue("8/");
  });

  it("clears with Escape and the C key", async () => {
    const user = userEvent.setup();
    render(<CalculatorWidget />);
    const input = screen.getByLabelText("นิพจน์ที่ต้องการคำนวณ");
    await user.type(input, "123{Escape}");
    expect(input).toHaveValue("");
    await user.type(input, "45");
    await user.click(screen.getByRole("button", { name: "ล้างทั้งหมด" }));
    expect(input).toHaveValue("");
  });
});
