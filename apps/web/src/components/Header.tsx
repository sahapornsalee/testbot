"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";

const LINKS = [
  { href: "/", key: "nav.dashboard" },
  { href: "/history", key: "nav.history" },
  { href: "/settings", key: "nav.settings" },
];

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
          {t("app.name")}
        </Link>
        <nav aria-label={t("nav.menu")} className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
