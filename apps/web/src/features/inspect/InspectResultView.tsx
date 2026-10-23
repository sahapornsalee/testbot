"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, api } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/format";
import type { InspectResult, Job } from "@/lib/types";
import { FormatPicker } from "./FormatPicker";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1.5 sm:grid-cols-3 sm:gap-3">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-900 dark:text-slate-100 sm:col-span-2">{value}</dd>
    </div>
  );
}

export function InspectResultView({
  result,
  onJobCreated,
}: {
  result: InspectResult;
  onJobCreated: (job: Job) => void;
}) {
  const { t, locale } = useI18n();
  const media = result.media;
  const [formatId, setFormatId] = useState<string | null>(media?.best_format_id ?? null);
  const selected = media?.formats.find((f) => f.format_id === formatId) ?? null;
  const [mergeAudio, setMergeAudio] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const needsMerge = selected?.kind === "video";
  // Without FFmpeg a video-only format is still offered, just without an audio track.
  const merge = needsMerge && Boolean(media?.ffmpeg_available) && mergeAudio;
  const canDownload = result.downloadable && (result.kind !== "media" || selected !== null);

  async function startDownload() {
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.createDownload(
        result.kind === "media" && selected
          ? { url: result.url, mode: "media", format_id: selected.format_id, merge_audio: merge }
          : { url: result.url, mode: "direct" },
      );
      setCreated(true);
      onJobCreated(job);
    } catch (err) {
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title={t("result.title")}>
      <dl className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row label={t("result.kind")} value={t(`result.kind_${result.kind}`)} />
        {media ? (
          <>
            <Row label={t("media.title")} value={media.title ?? t("common.unknown")} />
            {media.uploader && <Row label={t("media.uploader")} value={media.uploader} />}
            <Row label={t("media.duration")} value={formatDuration(media.duration_seconds) ?? t("common.unknown")} />
            {media.extractor && <Row label={t("media.source")} value={media.extractor} />}
          </>
        ) : (
          <>
            <Row label={t("result.filename")} value={result.filename} />
            <Row
              label={t("result.type")}
              value={
                <>
                  {result.content_type}
                  {result.declared_content_type && result.declared_content_type !== result.content_type && (
                    <span className="text-slate-500"> ({t("result.declaredType")}: {result.declared_content_type})</span>
                  )}
                </>
              }
            />
            <Row label={t("result.category")} value={t(`category.${result.category}`)} />
            <Row label={t("result.size")} value={formatBytes(result.size_bytes, locale) ?? t("common.unknown")} />
            <Row label={t("result.ranges")} value={result.accepts_ranges ? t("common.yes") : t("common.no")} />
            {result.redirect_chain.length > 0 && (
              <>
                <Row label={t("result.redirects")} value={result.redirect_chain.length} />
                <Row label={t("result.finalUrl")} value={<span className="font-mono text-xs">{result.final_url}</span>} />
              </>
            )}
          </>
        )}
      </dl>

      {result.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {result.warnings.map((warning) => (
            <li key={warning} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {t(`warnings.${warning}`)}
            </li>
          ))}
        </ul>
      )}

      {media && (
        <div className="mt-4 space-y-3">
          <FormatPicker formats={media.formats} bestId={media.best_format_id} selectedId={formatId} onSelect={setFormatId} />
          {needsMerge && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              {media.ffmpeg_available ? (
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={mergeAudio} onChange={(e) => setMergeAudio(e.target.checked)} className="mt-0.5" />
                  <span>
                    {t("media.mergeAudio")}
                    <span className="block text-xs text-slate-500">{t("media.mergeHint")}</span>
                  </span>
                </label>
              ) : (
                <p>{t("media.noFfmpeg")}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {!result.downloadable && <p className="text-sm text-slate-600 dark:text-slate-300">{t("result.notDownloadable")}</p>}
        <button
          type="button"
          onClick={startDownload}
          disabled={!canDownload || submitting}
          className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitting ? t("result.starting") : t("result.download")}
        </button>
        {created && !error && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
            {t("result.jobCreated")}
          </p>
        )}
        {error && <ErrorAlert code={error} />}
      </div>
    </Card>
  );
}
