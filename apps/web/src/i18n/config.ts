import en from "./messages/en.json";
import th from "./messages/th.json";

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_STORAGE_KEY = "ud.locale";

export type Messages = typeof en;
export const MESSAGES: Record<Locale, Messages> = { en, th };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Look up a dotted key, falling back to English, then to the key itself. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const lookup = (messages: Messages): string | undefined => {
    let node: unknown = messages;
    for (const part of key.split(".")) {
      if (node && typeof node === "object" && part in node) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return typeof node === "string" ? node : undefined;
  };
  const template = lookup(MESSAGES[locale]) ?? lookup(MESSAGES.en) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
