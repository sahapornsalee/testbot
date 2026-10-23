"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { api, getToken, setToken } from "@/lib/api";
import type { Health } from "@/lib/types";

export default function SettingsPage() {
  const { t } = useI18n();
  const [token, setTokenValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    setTokenValue(getToken() ?? "");
    api.health().then(setHealth).catch(() => setHealthError(true));
  }, []);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setToken(token.trim() || null);
    setSaved(true);
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      <Card title={t("language.label")}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{t("settings.languageHelp")}</p>
        <LanguageSwitcher />
      </Card>
      <Card title={t("settings.token")}>
        <form onSubmit={save} className="space-y-2">
          <label htmlFor="token" className="block text-sm text-slate-600 dark:text-slate-300">
            {t("settings.tokenHelp")}
          </label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => {
              setTokenValue(event.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              {t("settings.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setTokenValue("");
                setToken(null);
                setSaved(true);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
            >
              {t("settings.clear")}
            </button>
          </div>
          {saved && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
              {t("settings.saved")}
            </p>
          )}
        </form>
      </Card>
      <Card title={t("settings.server")}>
        {healthError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t("settings.unavailable")}</p>}
        {!health && !healthError && <p className="text-sm text-slate-500">{t("common.loading")}</p>}
        {health && (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <dt className="text-slate-500">{t("settings.version")}</dt>
            <dd>{health.version}</dd>
            <dt className="text-slate-500">{t("settings.environment")}</dt>
            <dd>{health.environment}</dd>
            <dt className="text-slate-500">{t("settings.auth")}</dt>
            <dd>{health.auth_required ? t("common.yes") : t("common.no")}</dd>
            <dt className="text-slate-500">{t("settings.tools")}</dt>
            <dd>
              {Object.entries(health.tools).map(([name, version]) => (
                <span key={name} className="block font-mono text-xs">
                  {name}: {version ?? t("settings.notInstalled")}
                </span>
              ))}
            </dd>
          </dl>
        )}
      </Card>
    </>
  );
}
