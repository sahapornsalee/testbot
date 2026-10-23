import { useCallback, useEffect, useRef, useState } from "react";
import type { Repository } from "../data/db";

export type CollectionStatus = "loading" | "ready" | "error";

export interface Collection<T> {
  status: CollectionStatus;
  items: T[];
  /** Human readable problem (load or save failure, skipped records). */
  error: string | null;
  save: (item: T) => void;
  saveMany: (items: T[]) => void;
  remove: (id: string) => void;
}

/**
 * Loads a repository into React state. Updates are applied optimistically and
 * persisted in the background; a failed write is reported, not swallowed.
 */
export function useCollection<T extends { id: string }>(repo: Repository<T>): Collection<T> {
  const [status, setStatus] = useState<CollectionStatus>("loading");
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    repo.getAll().then(
      ({ items: loaded, skipped }) => {
        if (!mounted.current) return;
        setItems(loaded);
        setStatus("ready");
        if (skipped > 0) setError(`ข้ามข้อมูลที่เสียหาย ${skipped} รายการ`);
      },
      () => {
        if (!mounted.current) return;
        setStatus("error");
        setError("เปิดพื้นที่เก็บข้อมูลไม่ได้ เบราว์เซอร์อาจปิดกั้น IndexedDB (เช่น โหมดส่วนตัว)");
      },
    );
    return () => {
      mounted.current = false;
    };
  }, [repo]);

  const persist = useCallback((operation: Promise<void>) => {
    operation.catch(() => {
      if (mounted.current) setError("บันทึกข้อมูลไม่สำเร็จ พื้นที่จัดเก็บอาจเต็มหรือถูกปิดกั้น");
    });
  }, []);

  const save = useCallback(
    (item: T) => {
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
      persist(repo.put(item));
    },
    [repo, persist],
  );

  const saveMany = useCallback(
    (changed: T[]) => {
      setItems((prev) => {
        const byId = new Map(changed.map((i) => [i.id, i]));
        const next = prev.map((i) => byId.get(i.id) ?? i);
        for (const item of changed) if (!prev.some((i) => i.id === item.id)) next.push(item);
        return next;
      });
      persist(repo.putMany(changed));
    },
    [repo, persist],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      persist(repo.remove(id));
    },
    [repo, persist],
  );

  return { status, items, error, save, saveMany, remove };
}
