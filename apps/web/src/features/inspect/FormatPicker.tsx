"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { describeFormat, formatBytes } from "@/lib/format";
import type { MediaFormat } from "@/lib/types";

const KIND_ORDER: MediaFormat["kind"][] = ["video+audio", "video", "audio"];

function score(format: MediaFormat): number {
  return (format.height ?? 0) * 10_000 + (format.fps ?? 0) * 10 + (format.tbr ?? format.abr ?? 0) / 1000;
}

export function FormatPicker({
  formats,
  bestId,
  selectedId,
  onSelect,
}: {
  formats: MediaFormat[];
  bestId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  if (formats.length === 0) {
    return <p className="text-sm text-slate-500">{t("media.noFormats")}</p>;
  }
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{t("media.selectFormat")}</legend>
      {KIND_ORDER.map((kind) => {
        const group = formats.filter((f) => f.kind === kind).sort((a, b) => score(b) - score(a));
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`media.kind_${kind}`)}</h4>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {group.map((format) => {
                const size = formatBytes(format.filesize, locale) ??
                  (format.filesize_approx ? t("media.sizeApprox", { size: formatBytes(format.filesize_approx, locale) ?? "" }) : null);
                return (
                  <li key={format.format_id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:border-slate-700 dark:has-[:checked]:bg-indigo-950">
                      <input
                        type="radio"
                        name="format"
                        value={format.format_id}
                        checked={selectedId === format.format_id}
                        onChange={() => onSelect(format.format_id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 break-words">
                        {describeFormat(format)}
                        {size && <span className="text-slate-500"> · {size}</span>}
                        {bestId === format.format_id && (
                          <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                            {t("media.best")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </fieldset>
  );
}
