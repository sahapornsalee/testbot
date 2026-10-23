import { useCallback, useRef, useState } from "react";
import { readJson, writeJson, type Parser } from "../lib/storage";

export type StorageIssue = "none" | "recovered" | "unavailable" | "write-failed";

/** React state mirrored to LocalStorage with validation on read. */
export function usePersistentState<T>(
  key: string,
  parse: Parser<T>,
  fallback: T | (() => T),
): [T, (next: T | ((prev: T) => T)) => void, StorageIssue] {
  const [initial] = useState(() =>
    readJson(key, parse, typeof fallback === "function" ? (fallback as () => T)() : fallback),
  );
  const [value, setValue] = useState<T>(initial.value);
  const [issue, setIssue] = useState<StorageIssue>(
    !initial.available ? "unavailable" : initial.recovered ? "recovered" : "none",
  );
  const latest = useRef(value);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(latest.current) : next;
      latest.current = resolved;
      setValue(resolved);
      setIssue(writeJson(key, resolved) ? "none" : "write-failed");
    },
    [key],
  );

  return [value, update, issue];
}
