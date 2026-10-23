"use client";

import { Card } from "@/components/Card";
import { JobList } from "@/features/jobs/JobList";
import { useJobs } from "@/features/jobs/useJobs";
import { useI18n } from "@/i18n/I18nProvider";

export default function HistoryPage() {
  const { t } = useI18n();
  const { jobs, error, refresh, cancel, pause, resume } = useJobs();
  return (
    <>
      <h1 className="text-2xl font-bold">{t("jobs.historyTitle")}</h1>
      <Card
        title={t("jobs.historyTitle")}
        actions={
          <button type="button" onClick={() => void refresh()} className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            {t("jobs.refresh")}
          </button>
        }
      >
        <JobList jobs={jobs} error={error} emptyKey="jobs.emptyHistory" onCancel={cancel} onPause={pause} onResume={resume} onRetry={refresh} />
      </Card>
    </>
  );
}
