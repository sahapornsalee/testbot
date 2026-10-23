import { useEffect, useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

/** Copies text to the clipboard and reports the outcome for a few seconds. */
export function useCopy(): [CopyState, (text: string) => void] {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(id);
  }, [state]);
  const copy = (text: string) => {
    if (!navigator.clipboard?.writeText) {
      setState("failed");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  };
  return [state, copy];
}

export const COPY_LABEL: Record<CopyState, string> = {
  idle: "คัดลอก",
  copied: "คัดลอกแล้ว",
  failed: "คัดลอกไม่สำเร็จ",
};
