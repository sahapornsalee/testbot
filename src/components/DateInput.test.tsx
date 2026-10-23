import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DateInput } from "./DateInput";

function Harness({ locale }: { locale: "th" | "en-GB" }) {
  const [value, setValue] = useState("2026-01-31");
  return (
    <>
      <DateInput label="วันที่" value={value} onChange={setValue} locale={locale} />
      <output>{value}</output>
    </>
  );
}

describe("DateInput", () => {
  it("shows Thai month names and the Buddhist-era year", async () => {
    const user = userEvent.setup();
    render(<Harness locale="th" />);
    expect(screen.getByLabelText("วันที่: ปี (พ.ศ.)")).toHaveValue("2569");
    expect(screen.getByLabelText("วันที่: เดือน")).toHaveDisplayValue("มกราคม");

    // Changing to February clamps 31 to the last day of the month.
    await user.selectOptions(screen.getByLabelText("วันที่: เดือน"), "2");
    expect(screen.getByRole("status")).toHaveTextContent("2026-02-28");

    const year = screen.getByLabelText("วันที่: ปี (พ.ศ.)");
    await user.clear(year);
    await user.type(year, "2567");
    expect(screen.getByRole("status")).toHaveTextContent("2024-02-28");
    await user.selectOptions(screen.getByLabelText("วันที่: วัน"), "29");
    expect(screen.getByRole("status")).toHaveTextContent("2024-02-29");
  });

  it("uses English month names and Common-era years for UK format", () => {
    render(<Harness locale="en-GB" />);
    expect(screen.getByLabelText("วันที่: ปี")).toHaveValue("2026");
    expect(screen.getByLabelText("วันที่: เดือน")).toHaveDisplayValue("January");
  });

  it("flags an impossible year without changing the value", async () => {
    const user = userEvent.setup();
    render(<Harness locale="th" />);
    const year = screen.getByLabelText("วันที่: ปี (พ.ศ.)");
    await user.clear(year);
    await user.type(year, "12");
    expect(year).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2026-01-31");
  });
});
