"use client";

import { useMemo, useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api } from "@/lib/api";
import type { BatchResult, PageLink } from "@/lib/types";

const FILTERS = ["all", "video", "audio", "image", "document", "archive", "other", "stream"] as const;
type Filter = (typeof FILTERS)[number];

/** IDM-style "grab all": pick files found on a web page and queue them in one go. */
export function PageLinks({ links, onQueued }: { links: PageLink[]; onQueued: () => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: links.length };
    for (const link of links) map[link.category] = (map[link.category] ?? 0) + 1;
    return map;
  }, [links]);
  const visible = links.filter((link) => filter === "all" || link.category === filter);
  const selectable = visible.filter((link) => link.category !== "stream");

  if (links.length === 0) {
    return <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("links.none")}</p>;
  }

  function toggle(url: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function download() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const urls = links.filter((link) => selected.has(link.url)).map((link) => link.url);
      const response = await api.createBatch(urls.map((url) => ({ url, mode: "direct" })));
      setResult(response);
      setSelected(new Set());
      onQueued();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold">{t("links.title", { n: links.length })}</h3>
      <div role="group" aria-label={t("links.title", { n: links.length })} className="flex flex-wrap gap-1.5">
        {FILTERS.filter((key) => counts[key]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === key
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {key === "all" ? t("links.all") : key === "stream" ? t("links.stream") : t(`category.${key}`)} ({counts[key]})
          </button>
        ))}
      </div>
      {filter === "stream" && <p className="text-xs text-slate-500">{t("links.streamNote")}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          className="font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          onClick={() => setSelected(new Set([...selected, ...selectable.map((link) => link.url)]))}
        >
          {t("links.selectAll")}
        </button>
        <button
          type="button"
          className="font-medium text-indigo-700 hover:underline dark:text-indigo-300"
          onClick={() => setSelected(new Set())}
        >
          {t("links.selectNone")}
        </button>
      </div>
      <ul className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
        {visible.map((link) => {
          const disabled = link.category === "stream";
          return (
            <li key={link.url}>
              <label
                className={`flex items-start gap-2 rounded-md p-2 text-sm ${disabled ? "opacity-60" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(link.url)}
                  disabled={disabled}
                  onChange={() => toggle(link.url)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{link.label || link.url.split("/").pop() || link.url}</span>
                  <span className="block break-all font-mono text-xs text-slate-500">{link.url}</span>
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {link.extension ? link.extension.toUpperCase() : t(`category.${link.category}`)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={download}
        disabled={selected.size === 0 || submitting}
        className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submitting ? t("batch.submitting") : t("links.download", { n: selected.size })}
      </button>
      {result && <BatchSummary result={result} />}
      {error && <ErrorAlert code={error} />}
    </div>
  );
}

export function BatchSummary({ result, lineOffset = 1 }: { result: BatchResult; lineOffset?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" className="space-y-1 text-sm">
      <p className="text-emerald-700 dark:text-emerald-300">
        {t("batch.result", { created: result.created.length, failed: result.errors.length })}
      </p>
      {result.errors.length > 0 && (
        <ul className="list-inside list-disc text-xs text-red-700 dark:text-red-300">
          {result.errors.map((item) => {
            const key = `errors.${item.error.code}`;
            const reason = t(key) === key ? t("errors.UNKNOWN") : t(key);
            return (
              <li key={item.index} className="break-all">
                {t("batch.failedItem", { line: item.index + lineOffset, reason })} — {item.url}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
