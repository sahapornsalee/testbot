"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { InspectResultView } from "@/features/inspect/InspectResultView";
import { UrlForm } from "@/features/inspect/UrlForm";
import { JobList } from "@/features/jobs/JobList";
import { useJobs } from "@/features/jobs/useJobs";
import { useI18n } from "@/i18n/I18nProvider";
import { ACTIVE_STATUSES, type InspectResult } from "@/lib/types";

const RECENT_FINISHED = 5;

export default function DashboardPage() {
  const { t } = useI18n();
  const [result, setResult] = useState<InspectResult | null>(null);
  const { jobs, error, refresh, cancel } = useJobs();
  const queue = jobs
    ? [
        ...jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)),
        ...jobs.filter((job) => !ACTIVE_STATUSES.includes(job.status)).slice(0, RECENT_FINISHED),
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
      {result && <InspectResultView key={result.url} result={result} onJobCreated={() => void refresh()} />}
      <Card title={t("jobs.queueTitle")}>
        <JobList jobs={queue} error={error} emptyKey="jobs.empty" onCancel={cancel} onRetry={refresh} />
      </Card>
    </>
  );
}
