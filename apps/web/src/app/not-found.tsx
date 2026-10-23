"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-bold">{t("notFound.title")}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t("notFound.description")}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-indigo-700 underline dark:text-indigo-300">
        {t("common.backHome")}
      </Link>
    </div>
  );
}
