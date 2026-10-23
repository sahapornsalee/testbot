"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { ACTIVE_STATUSES, type Job } from "@/lib/types";

const ACTIVE_POLL_MS = 1000;
const IDLE_POLL_MS = 10_000;

/** Loads the current session's jobs and polls faster while any job is active. */
export function useJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let next = IDLE_POLL_MS;
    try {
      const { items } = await api.listDownloads();
      if (!mounted.current) return;
      setJobs(items);
      setError(null);
      if (items.some((job) => ACTIVE_STATUSES.includes(job.status))) next = ACTIVE_POLL_MS;
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof ApiError ? err.code : "UNKNOWN");
    }
    if (mounted.current) timer.current = setTimeout(refresh, next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const cancel = useCallback(
    async (id: string) => {
      try {
        await api.cancelDownload(id);
      } catch (err) {
        setError(err instanceof ApiError ? err.code : "UNKNOWN");
      }
      await refresh();
    },
    [refresh],
  );

  return { jobs, error, refresh, cancel };
}
