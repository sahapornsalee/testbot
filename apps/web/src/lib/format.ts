const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number | null | undefined, locale = "en"): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDateTime(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function describeFormat(format: {
  height: number | null;
  fps: number | null;
  abr: number | null;
  ext: string | null;
  note: string | null;
  vcodec: string | null;
  acodec: string | null;
}): string {
  const parts: string[] = [];
  if (format.height) parts.push(`${format.height}p${format.fps && format.fps > 30 ? Math.round(format.fps) : ""}`);
  if (!format.height && format.abr) parts.push(`${Math.round(format.abr)} kbps`);
  if (format.ext) parts.push(format.ext.toUpperCase());
  const codecs = [format.vcodec, format.acodec].filter(Boolean).map((c) => String(c).split(".")[0]);
  if (codecs.length) parts.push(codecs.join("/"));
  if (format.note && !parts.some((p) => p.includes(format.note as string))) parts.push(format.note);
  return parts.join(" · ");
}
