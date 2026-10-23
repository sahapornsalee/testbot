import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { renderWithI18n } from "./helpers";

function Title() {
  const { t } = useI18n();
  return <h1>{t("inspect.title")}</h1>;
}

describe("LanguageSwitcher", () => {
  it("switches between Thai and English and remembers the choice", async () => {
    renderWithI18n(
      <>
        <LanguageSwitcher />
        <Title />
      </>,
      "th",
    );
    expect(screen.getByRole("heading")).toHaveTextContent("วิเคราะห์ลิงก์");
    expect(document.documentElement.lang).toBe("th");

    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading")).toHaveTextContent("Analyze a link");
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("ud.locale")).toBe("en");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  });
});
