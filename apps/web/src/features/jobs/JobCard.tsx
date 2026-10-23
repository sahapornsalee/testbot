"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProgressBar } from "@/components/ProgressBar";
import { useI18n } from "@/i18n/I18nProvider";
import { ApiError, saveJobFile } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ACTIVE_STATUSES, type Job } from "@/lib/types";

const STATUS_STYLES: Record<Job["status"], string> = {
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  inspecting: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  downloading: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  processing: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  paused: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  cancelled: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  expired: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export type JobActions = {
  onCancel: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
};

export function JobCard({ job, onCancel, onPause, onResume }: { job: Job } & JobActions) {
  const { t, locale } = useI18n();
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = ACTIVE_STATUSES.includes(job.status);
  const showProgress = active || job.status === "paused";
  const cancellable = active || job.status === "paused";
  const done = formatBytes(job.downloaded_bytes, locale) ?? "0 B";
  const total = formatBytes(job.expected_size ?? job.actual_size, locale);

  async function save() {
    setSaveError(null);
    try {
      await saveJobFile(job);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.code : "UNKNOWN");
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="job-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-slate-900 dark:text-slate-100">{job.filename ?? job.source_host}</p>
          <p className="text-xs text-slate-500">
            {job.source_host}
            {job.category ? ` · ${t(`category.${job.category}`)}` : ""}
            {` · ${t("jobs.jobId")}: `}
            <span className="font-mono">{job.id.slice(0, 8)}</span>
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[job.status]}`}>
          {t(`jobs.status.${job.status}`)}
        </span>
      </div>

      {showProgress && (
        <div className="mt-2 space-y-1">
          <ProgressBar value={job.progress} label={t(`jobs.status.${job.status}`)} />
          <p className="text-xs text-slate-500">
            {total ? t("jobs.progress", { done, total }) : t("jobs.progressUnknown", { done })}
            {job.connections
              ? ` · ${job.connections === 1 ? t("jobs.oneConnection") : t("jobs.connections", { n: job.connections })}`
              : ""}
          </p>
        </div>
      )}

      {job.error && (
        <div className="mt-2">
          <ErrorAlert code={job.error.code} />
        </div>
      )}
      {saveError && (
        <div className="mt-2">
          <ErrorAlert code={saveError} />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {t("jobs.created")}: {formatDateTime(job.created_at, locale)}
          {job.finished_at && ` · ${t("jobs.finished")}: ${formatDateTime(job.finished_at, locale)}`}
          {job.status === "completed" && total && ` · ${t("jobs.size")}: ${total}`}
        </span>
        <div className="flex flex-wrap gap-2">
          {job.can_pause && onPause && (
            <button
              type="button"
              onClick={() => onPause(job.id)}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("jobs.pause")}
            </button>
          )}
          {job.can_resume && onResume && (
            <button
              type="button"
              onClick={() => onResume(job.id)}
              className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t("jobs.resume")}
            </button>
          )}
          {cancellable && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("jobs.cancel")}
            </button>
          )}
          {job.download_available && (
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {t("jobs.saveFile")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
