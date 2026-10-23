"use client";

import { useI18n } from "@/i18n/I18nProvider";

export function LegalNotice() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500 dark:text-slate-400">
      <p>{t("legal.notice")}</p>
    </footer>
  );
}
