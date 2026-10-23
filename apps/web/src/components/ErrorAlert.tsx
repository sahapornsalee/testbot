"use client";

import { useI18n } from "@/i18n/I18nProvider";

/** Shows a localized message for a stable API error code. */
export function ErrorAlert({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const key = `errors.${code}`;
  const message = t(key) === key ? t("errors.UNKNOWN") : t(key);
  return (
    <div role="alert" className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p className="min-w-0 break-words">
        {message} <span className="font-mono text-xs opacity-70">({code})</span>
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline">
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
