"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api } from "@/lib/api";
import type { InspectResult } from "@/lib/types";

export function UrlForm({ onResult }: { onResult: (result: InspectResult | null) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("EMPTY");
      return;
    }
    setLoading(true);
    setError(null);
    onResult(null);
    try {
      onResult(await api.inspect(trimmed));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <label htmlFor="url-input" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("inspect.label")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="url-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("inspect.placeholder")}
          maxLength={2048}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("inspect.analyzing") : t("inspect.analyze")}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("inspect.help")}</p>
      {error === "EMPTY" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t("inspect.emptyUrl")}
        </p>
      )}
      {error && error !== "EMPTY" && <ErrorAlert code={error} onRetry={() => submit()} />}
    </form>
  );
}
