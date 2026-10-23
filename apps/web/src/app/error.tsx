"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-center dark:border-red-900 dark:bg-slate-900">
      <h1 className="text-xl font-bold">{t("errorPage.title")}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t("errorPage.description")}</p>
      <div className="mt-4 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          {t("common.retry")}
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
          {t("common.backHome")}
        </Link>
      </div>
    </div>
  );
}
