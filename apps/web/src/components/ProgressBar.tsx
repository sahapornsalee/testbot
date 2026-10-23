export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const percent = value === null ? null : Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
    >
      <div
        className={`h-full rounded-full bg-indigo-600 transition-all ${percent === null ? "w-1/3 animate-pulse" : ""}`}
        style={percent === null ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
