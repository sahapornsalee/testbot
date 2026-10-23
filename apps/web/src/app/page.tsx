"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { BatchForm } from "@/features/inspect/BatchForm";
import { InspectResultView } from "@/features/inspect/InspectResultView";
import { UrlForm } from "@/features/inspect/UrlForm";
import { JobList } from "@/features/jobs/JobList";
import { useJobs } from "@/features/jobs/useJobs";
import { useI18n } from "@/i18n/I18nProvider";
import { QUEUE_STATUSES, type InspectResult } from "@/lib/types";

const RECENT_FINISHED = 5;

export default function DashboardPage() {
  const { t } = useI18n();
  const [result, setResult] = useState<InspectResult | null>(null);
  const { jobs, error, refresh, cancel, pause, resume } = useJobs();
  const queue = jobs
    ? [
        ...jobs.filter((job) => QUEUE_STATUSES.includes(job.status)),
        ...jobs.filter((job) => !QUEUE_STATUSES.includes(job.status)).slice(0, RECENT_FINISHED),
      ]
    : null;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t("inspect.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t("app.tagline")}</p>
      </div>
      <Card title={t("inspect.label")}>
        <UrlForm onResult={setResult} />
      </Card>
      {result && (
        <InspectResultView
          key={result.url}
          result={result}
          onJobCreated={() => void refresh()}
          onQueued={() => void refresh()}
        />
      )}
      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <summary className="cursor-pointer text-base font-semibold">{t("batch.title")}</summary>
        <div className="mt-3">
          <BatchForm onQueued={() => void refresh()} />
        </div>
      </details>
      <Card title={t("jobs.queueTitle")}>
        <JobList
          jobs={queue}
          error={error}
          emptyKey="jobs.empty"
          onCancel={cancel}
          onPause={pause}
          onResume={resume}
          onRetry={refresh}
        />
      </Card>
    </>
  );
}
