import type { Metadata, Viewport } from "next";
import { Header } from "@/components/Header";
import { LegalNotice } from "@/components/LegalNotice";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Downloader",
  description: "Inspect links and download files and media you are allowed to save.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <I18nProvider>
          <Header />
          <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">{children}</main>
          <LegalNotice />
        </I18nProvider>
      </body>
    </html>
  );
}
