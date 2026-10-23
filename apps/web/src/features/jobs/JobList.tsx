"use client";

import { ErrorAlert } from "@/components/ErrorAlert";
import { useI18n } from "@/i18n/I18nProvider";
import type { Job } from "@/lib/types";
import { JobCard } from "./JobCard";

export function JobList({
  jobs,
  error,
  emptyKey,
  onCancel,
  onRetry,
}: {
  jobs: Job[] | null;
  error: string | null;
  emptyKey: string;
  onCancel: (id: string) => void;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (error && !jobs) return <ErrorAlert code={error} onRetry={onRetry} />;
  if (!jobs) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  return (
    <div className="space-y-2">
      {error && <ErrorAlert code={error} onRetry={onRetry} />}
      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">
          {t(emptyKey)}
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onCancel={onCancel} />
          ))}
        </ul>
      )}
    </div>
  );
}
