// Mirrors services/api/app/schemas/models.py. Keep both in sync.

export type Category = "image" | "video" | "audio" | "document" | "archive" | "other";
export type JobStatus =
  | "queued"
  | "inspecting"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export const ACTIVE_STATUSES: JobStatus[] = ["queued", "inspecting", "downloading", "processing"];

export type MediaFormat = {
  format_id: string;
  ext: string | null;
  kind: "video+audio" | "video" | "audio";
  width: number | null;
  height: number | null;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  abr: number | null;
  tbr: number | null;
  filesize: number | null;
  filesize_approx: number | null;
  note: string | null;
};

export type MediaInfo = {
  title: string | null;
  duration_seconds: number | null;
  uploader: string | null;
  extractor: string | null;
  thumbnail: string | null;
  formats: MediaFormat[];
  best_format_id: string | null;
  ffmpeg_available: boolean;
};

export type InspectResult = {
  url: string;
  final_url: string;
  redirect_chain: string[];
  kind: "file" | "media" | "webpage";
  status_code: number;
  content_type: string;
  declared_content_type: string | null;
  category: Category;
  size_bytes: number | null;
  filename: string;
  extension: string | null;
  accepts_ranges: boolean;
  downloadable: boolean;
  warnings: string[];
  media: MediaInfo | null;
};

export type Job = {
  id: string;
  status: JobStatus;
  mode: "direct" | "media";
  source_host: string;
  filename: string | null;
  category: string | null;
  content_type: string | null;
  format_id: string | null;
  expected_size: number | null;
  actual_size: number | null;
  downloaded_bytes: number;
  progress: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: { code: string; message: string } | null;
  download_available: boolean;
};

export type Health = {
  status: "ok";
  version: string;
  environment: string;
  auth_required: boolean;
  tools: Record<string, string | null>;
};

export type CreateDownload = {
  url: string;
  mode: "direct" | "media";
  format_id?: string;
  merge_audio?: boolean;
};
