import { render } from "@testing-library/react";
import { vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";

export function renderWithI18n(ui: React.ReactElement, locale: Locale = "en") {
  return render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function mockFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fn.mockRejectedValueOnce(response);
    else fn.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}
