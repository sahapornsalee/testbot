"use client";

import { useMemo, useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api } from "@/lib/api";
import type { BatchResult, CreateDownload, PageLink } from "@/lib/types";

const FILTERS = ["all", "video", "media", "stream", "audio", "image", "document", "archive", "other", "link"] as const;
type Filter = (typeof FILTERS)[number];
const BATCH_SIZE = 50;
const PAGE_KEY = "__page__";

/** Which downloader handles a found item. */
export function itemRequest(link: PageLink): CreateDownload | null {
  if (link.category === "stream") {
    return link.extension === "m3u8" || link.url.toLowerCase().includes(".m3u8")
      ? { url: link.url, mode: "hls", format_id: "best" }
      : null; // DASH (.mpd) is not supported yet
  }
  if (link.category === "media") return { url: link.url, mode: "media", format_id: "best", merge_audio: true };
  return { url: link.url, mode: "direct" };
}

/** IDM-style "grab all": pick anything found on a web page and queue it in one go. */
export function PageLinks({
  pageUrl,
  links,
  onQueued,
}: {
  pageUrl: string;
  links: PageLink[];
  onQueued: () => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: links.length };
    for (const link of links) map[link.category] = (map[link.category] ?? 0) + 1;
    return map;
  }, [links]);
  const visible = links.filter((link) => filter === "all" || link.category === filter);
  // "Select all" on the All tab takes every file but not ordinary links (often just pages).
  const selectable = visible.filter((link) => itemRequest(link) && (filter !== "all" || link.category !== "link"));

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function download() {
    setError(null);
    setResult(null);
    const items: CreateDownload[] = [];
    if (selected.has(PAGE_KEY)) items.push({ url: pageUrl, mode: "page" });
    for (const link of links) {
      const request = itemRequest(link);
      if (request && selected.has(link.url)) items.push(request);
    }
    const combined: BatchResult = { created: [], errors: [] };
    setProgress({ done: 0, total: items.length });
    try {
      for (let start = 0; start < items.length; start += BATCH_SIZE) {
        const response = await api.createBatch(items.slice(start, start + BATCH_SIZE));
        combined.created.push(...response.created);
        combined.errors.push(...response.errors.map((item) => ({ ...item, index: item.index + start })));
        setProgress({ done: Math.min(start + BATCH_SIZE, items.length), total: items.length });
      }
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    } finally {
      setResult(combined.created.length || combined.errors.length ? combined : null);
      setProgress(null);
      onQueued();
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
        <input type="checkbox" checked={selected.has(PAGE_KEY)} onChange={() => toggle(PAGE_KEY)} className="mt-0.5" />
        <span className="min-w-0">
          <span className="block font-medium">{t("links.savePage")}</span>
          <span className="block break-all font-mono text-xs text-slate-500">{pageUrl}</span>
        </span>
      </label>

      {links.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("links.none")}</p>
      ) : (
        <>
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
                {key === "all" || key === "stream" || key === "media" || key === "link" ? t(`links.${key}`) : t(`category.${key}`)} (
                {counts[key]})
              </button>
            ))}
          </div>
          {(filter === "stream" || (filter === "all" && counts.stream)) && (
            <p className="text-xs text-slate-500">{t("links.streamNote")}</p>
          )}
          {(filter === "link" || (filter === "all" && counts.link)) && (
            <p className="text-xs text-slate-500">{t("links.linkNote")}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
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
            <span className="text-xs text-slate-500">{t("links.selected", { n: selected.size })}</span>
          </div>
          <ul className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {visible.map((link) => {
              const disabled = itemRequest(link) === null;
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
        </>
      )}
      <button
        type="button"
        onClick={download}
        disabled={selected.size === 0 || progress !== null}
        className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {progress ? t("links.adding", progress) : t("links.download", { n: selected.size })}
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
