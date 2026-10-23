"use client";

import { LOCALES } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t("language.label")} className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
            locale === code
              ? "bg-indigo-600 text-white"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
