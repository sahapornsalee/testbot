import type { CreateDownload, Health, InspectResult, Job } from "./types";

export const API_BASE = "/api/v1";
export const TOKEN_STORAGE_KEY = "ud.token";

/** An API failure carrying the stable server error code (or NETWORK / UNKNOWN). */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore unavailable storage
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  // Custom header required by the API for state-changing requests (CSRF protection).
  headers.set("X-UD-Client", "web");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError("NETWORK", "Network error");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (error?.code) throw new ApiError(error.code, error.message ?? error.code, response.status);
    throw new ApiError(response.status >= 500 ? "NETWORK" : "UNKNOWN", "Request failed", response.status);
  }
  return data as T;
}

export const api = {
  health: () => request<Health>("/health"),
  inspect: (url: string) =>
    request<InspectResult>("/inspect", { method: "POST", body: JSON.stringify({ url }) }),
  createDownload: (body: CreateDownload) =>
    request<Job>("/downloads", { method: "POST", body: JSON.stringify(body) }),
  listDownloads: () => request<{ items: Job[] }>("/downloads"),
  getDownload: (id: string) => request<Job>(`/downloads/${encodeURIComponent(id)}`),
  cancelDownload: (id: string) =>
    request<Job>(`/downloads/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  fileUrl: (id: string) => `${API_BASE}/downloads/${encodeURIComponent(id)}/file`,
};

/** Fetch a finished file and hand it to the browser's download/save mechanism. */
export async function saveJobFile(job: Job): Promise<void> {
  const token = getToken();
  if (!token) {
    // Cookie session: a plain link lets the browser stream the file to disk directly.
    const link = document.createElement("a");
    link.href = api.fileUrl(job.id);
    link.download = job.filename ?? "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  // Token mode: headers cannot be attached to a plain link, so fetch as a blob.
  const response = await fetch(api.fileUrl(job.id), {
    headers: { Authorization: `Bearer ${token}`, "X-UD-Client": "web" },
  });
  if (!response.ok) throw new ApiError("JOB_NOT_READY", "File not available", response.status);
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = job.filename ?? "download";
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
