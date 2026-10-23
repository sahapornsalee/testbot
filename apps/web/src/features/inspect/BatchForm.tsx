"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api } from "@/lib/api";
import type { BatchResult } from "@/lib/types";
import { BatchSummary } from "./PageLinks";

const MAX_LINKS = 50;

export function parseLinks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_LINKS);
}

/** Paste many links (like IDM's "add batch download") and queue them all. */
export function BatchForm({ onQueued }: { onQueued: () => void }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const links = parseLinks(text);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (links.length === 0) {
      setError("EMPTY");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.createBatch(links.map((url) => ({ url, mode: "direct" })));
      setResult(response);
      if (response.errors.length === 0) setText("");
      onQueued();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="batch-input" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {t("batch.label")}
      </label>
      <textarea
        id="batch-input"
        rows={4}
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"https://example.com/a.zip\nhttps://example.com/b.pdf"}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("batch.help")}</p>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? t("batch.submitting") : t("batch.submit", { n: links.length })}
      </button>
      {error === "EMPTY" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t("batch.empty")}
        </p>
      )}
      {error && error !== "EMPTY" && <ErrorAlert code={error} />}
      {result && <BatchSummary result={result} />}
    </form>
  );
}
