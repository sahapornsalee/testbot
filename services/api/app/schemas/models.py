"""Request/response schemas shared by the API routes."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.services.file_types import Category

FORMAT_ID_PATTERN = r"^[A-Za-z0-9_.\-]{1,64}$"


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    environment: str
    auth_required: bool
    tools: dict[str, str | None]


class InspectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2048)


class MediaFormat(BaseModel):
    format_id: str
    ext: str | None = None
    kind: Literal["video+audio", "video", "audio"]
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    vcodec: str | None = None
    acodec: str | None = None
    abr: float | None = None
    tbr: float | None = None
    filesize: int | None = None
    filesize_approx: int | None = None
    note: str | None = None


class MediaInfo(BaseModel):
    title: str | None = None
    duration_seconds: float | None = None
    uploader: str | None = None
    extractor: str | None = None
    thumbnail: str | None = None
    formats: list[MediaFormat] = []
    best_format_id: str | None = None
    ffmpeg_available: bool = False


class PageLink(BaseModel):
    """A downloadable resource found on a web page (IDM-style "grab all links")."""

    url: str
    category: Category | Literal["stream"]
    extension: str | None
    source: str  # the HTML element it came from: a, img, video, audio, source, ...
    label: str | None = None


class InspectResponse(BaseModel):
    url: str
    final_url: str
    redirect_chain: list[str]
    kind: Literal["file", "media", "webpage"]
    status_code: int
    content_type: str
    declared_content_type: str | None
    category: Category
    size_bytes: int | None
    filename: str
    extension: str | None
    accepts_ranges: bool
    downloadable: bool
    warnings: list[str]
    media: MediaInfo | None = None
    links: list[PageLink] = []


class DownloadMode(StrEnum):
    DIRECT = "direct"
    MEDIA = "media"


class CreateDownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2048)
    mode: DownloadMode = DownloadMode.DIRECT
    format_id: str | None = Field(default=None, pattern=FORMAT_ID_PATTERN)
    merge_audio: bool = False


class JobStatus(StrEnum):
    QUEUED = "queued"
    INSPECTING = "inspecting"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class JobView(BaseModel):
    id: str
    status: JobStatus
    mode: DownloadMode
    source_host: str
    filename: str | None
    category: str | None
    content_type: str | None
    format_id: str | None
    expected_size: int | None
    actual_size: int | None
    downloaded_bytes: int
    progress: float | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error: ErrorBody | None
    download_available: bool
    connections: int | None = None
    can_pause: bool = False
    can_resume: bool = False


class JobList(BaseModel):
    items: list[JobView]


class BatchDownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[CreateDownloadRequest] = Field(min_length=1, max_length=500)


class BatchError(BaseModel):
    index: int
    url: str
    error: ErrorBody


class BatchDownloadResponse(BaseModel):
    created: list[JobView]
    errors: list[BatchError]
