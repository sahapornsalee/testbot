import type { InspectResult, Job } from "@/lib/types";

export const fileResult: InspectResult = {
  url: "https://files.example.com/report.pdf",
  final_url: "https://cdn.example.com/report.pdf",
  redirect_chain: ["https://files.example.com/report.pdf"],
  kind: "file",
  status_code: 200,
  content_type: "application/pdf",
  declared_content_type: "application/octet-stream",
  category: "document",
  size_bytes: 1536000,
  filename: "report.pdf",
  extension: ".pdf",
  accepts_ranges: true,
  downloadable: true,
  warnings: [],
  media: null,
};

export const mediaResult: InspectResult = {
  ...fileResult,
  url: "https://video.example.com/watch?v=1",
  final_url: "https://video.example.com/watch?v=1",
  redirect_chain: [],
  kind: "media",
  content_type: "video/*",
  category: "video",
  size_bytes: null,
  filename: "Clip",
  media: {
    title: "Clip",
    duration_seconds: 125,
    uploader: "Uploader",
    extractor: "Fixture",
    thumbnail: null,
    best_format_id: "137",
    ffmpeg_available: true,
    formats: [
      { format_id: "18", ext: "mp4", kind: "video+audio", width: 640, height: 360, fps: 30, vcodec: "avc1", acodec: "mp4a", abr: null, tbr: 500, filesize: 4_000_000, filesize_approx: null, note: null },
      { format_id: "137", ext: "mp4", kind: "video", width: 1920, height: 1080, fps: 30, vcodec: "avc1", acodec: null, abr: null, tbr: 4000, filesize: null, filesize_approx: 30_000_000, note: null },
      { format_id: "140", ext: "m4a", kind: "audio", width: null, height: null, fps: null, vcodec: null, acodec: "mp4a", abr: 129, tbr: null, filesize: null, filesize_approx: null, note: null },
    ],
  },
};

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "0123456789abcdef0123456789abcdef",
    status: "downloading",
    mode: "direct",
    source_host: "files.example.com",
    filename: "report.pdf",
    category: "document",
    content_type: "application/pdf",
    format_id: null,
    expected_size: 2048,
    actual_size: null,
    downloaded_bytes: 1024,
    progress: 0.5,
    created_at: "2026-10-23T10:00:00Z",
    started_at: "2026-10-23T10:00:01Z",
    finished_at: null,
    error: null,
    download_available: false,
    ...overrides,
  };
}
