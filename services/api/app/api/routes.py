"""HTTP routes for /api/v1."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import FileResponse

from app import __version__
from app.core.context import AppContext
from app.core.errors import AppError, ErrorCode
from app.core.security import check_csrf, client_key, resolve_owner
from app.schemas.models import (
    BatchDownloadRequest,
    BatchDownloadResponse,
    BatchError,
    CreateDownloadRequest,
    ErrorBody,
    ErrorResponse,
    HealthResponse,
    InspectRequest,
    InspectResponse,
    JobList,
    JobStatus,
    JobView,
)
from app.services import media
from app.services.inspection import inspect_url
from app.services.job_store import JobRecord
from app.workers.runner import PAUSABLE_MODES, PAUSABLE_STATUSES

router = APIRouter(prefix="/api/v1", responses={400: {"model": ErrorResponse}})
JobId = Annotated[str, Path(pattern=r"^[0-9a-f]{32}$")]
INLINE_UNSAFE_TYPES = (
    "text/html",
    "image/svg+xml",
    "application/xml",
    "text/xml",
    "application/xhtml+xml",
)


def get_ctx(request: Request) -> AppContext:
    return request.app.state.ctx


def owner_dep(request: Request, ctx: Annotated[AppContext, Depends(get_ctx)]) -> str:
    check_csrf(request, ctx.settings)
    return resolve_owner(request, ctx.settings)


Ctx = Annotated[AppContext, Depends(get_ctx)]
Owner = Annotated[str, Depends(owner_dep)]


def to_view(job: JobRecord) -> JobView:
    expected = job.expected_size
    progress = None
    if job.status == JobStatus.COMPLETED:
        progress = 1.0
    elif expected:
        progress = min(job.downloaded_bytes / expected, 1.0)
    return JobView(
        id=job.id,
        status=job.status,
        mode=job.mode,
        source_host=job.source_host,
        filename=job.filename,
        category=job.category,
        content_type=job.content_type,
        format_id=job.format_id,
        expected_size=expected,
        actual_size=job.actual_size,
        downloaded_bytes=job.downloaded_bytes,
        progress=progress,
        created_at=job.created_at,  # type: ignore[arg-type]
        started_at=job.started_at,
        finished_at=job.finished_at,
        error=ErrorBody(code=job.error_code, message=job.error_message or job.error_code)
        if job.error_code
        else None,
        download_available=job.status == JobStatus.COMPLETED and job.file_path is not None,
        connections=job.connections,
        can_pause=job.mode in PAUSABLE_MODES and job.status in PAUSABLE_STATUSES,
        can_resume=job.status == JobStatus.PAUSED,
    )


@router.get("/health", response_model=HealthResponse)
async def health(ctx: Ctx) -> HealthResponse:
    ffmpeg = media.ffmpeg_path(ctx.settings.ffmpeg_location)
    return HealthResponse(
        status="ok",
        version=__version__,
        environment=ctx.settings.app_env,
        auth_required=ctx.settings.auth_required,
        tools={"yt_dlp": media.ytdlp_version(), "ffmpeg": media.ffmpeg_version(ffmpeg)},
    )


@router.post("/inspect", response_model=InspectResponse)
async def inspect(
    body: InspectRequest, request: Request, ctx: Ctx, owner: Owner
) -> InspectResponse:
    ctx.rate_limiter.hit(client_key(request))
    ctx.rate_limiter.hit(owner)
    async with ctx.client_factory() as client:
        return await inspect_url(body.url, settings=ctx.settings, policy=ctx.policy, client=client)


@router.post("/downloads", response_model=JobView, status_code=202)
async def create_download(
    body: CreateDownloadRequest, request: Request, ctx: Ctx, owner: Owner
) -> JobView:
    ctx.rate_limiter.hit(client_key(request))
    ctx.rate_limiter.hit(owner)
    await ctx.policy.validate(body.url)
    job = ctx.runner.create_job(owner, body)
    return to_view(job)


@router.post("/downloads/batch", response_model=BatchDownloadResponse, status_code=202)
async def create_download_batch(
    body: BatchDownloadRequest, request: Request, ctx: Ctx, owner: Owner
) -> BatchDownloadResponse:
    """Queue many downloads at once. Each item is validated on its own; failures are
    reported per item instead of failing the whole batch."""
    if len(body.items) > ctx.settings.max_batch_size:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"A batch may contain at most {ctx.settings.max_batch_size} links",
        )
    ctx.rate_limiter.hit(client_key(request))
    ctx.rate_limiter.hit(owner)
    created: list[JobView] = []
    errors: list[BatchError] = []
    for index, item in enumerate(body.items):
        try:
            await ctx.policy.validate(item.url)
            created.append(to_view(ctx.runner.create_job(owner, item)))
        except AppError as exc:
            errors.append(
                BatchError(
                    index=index,
                    url=item.url[:300],
                    error=ErrorBody(code=exc.code.value, message=exc.message),
                )
            )
    return BatchDownloadResponse(created=created, errors=errors)


@router.get("/downloads", response_model=JobList)
async def list_downloads(ctx: Ctx, owner: Owner) -> JobList:
    return JobList(items=[to_view(job) for job in ctx.store.list_for_owner(owner)])


@router.get("/downloads/{job_id}", response_model=JobView)
async def get_download(job_id: JobId, ctx: Ctx, owner: Owner) -> JobView:
    return to_view(ctx.store.get_for_owner(job_id, owner))


@router.post("/downloads/{job_id}/cancel", response_model=JobView)
async def cancel_download(job_id: JobId, ctx: Ctx, owner: Owner) -> JobView:
    ctx.runner.cancel(owner, job_id)
    return to_view(ctx.store.get_for_owner(job_id, owner))


@router.post("/downloads/{job_id}/pause", response_model=JobView)
async def pause_download(job_id: JobId, ctx: Ctx, owner: Owner) -> JobView:
    ctx.runner.pause(owner, job_id)
    return to_view(ctx.store.get_for_owner(job_id, owner))


@router.post("/downloads/{job_id}/resume", response_model=JobView)
async def resume_download(job_id: JobId, ctx: Ctx, owner: Owner) -> JobView:
    ctx.runner.resume(owner, job_id)
    return to_view(ctx.store.get_for_owner(job_id, owner))


@router.get("/downloads/{job_id}/file", response_class=FileResponse)
async def download_file(job_id: JobId, ctx: Ctx, owner: Owner) -> FileResponse:
    job = ctx.store.get_for_owner(job_id, owner)
    if job.status != JobStatus.COMPLETED or not job.file_path:
        raise AppError(ErrorCode.JOB_NOT_READY, "The file is not ready or has expired")
    path = ctx.storage.resolve_relative(job.file_path)
    if not path.is_file():
        raise AppError(ErrorCode.JOB_NOT_READY, "The file is not ready or has expired")
    media_type = job.content_type or "application/octet-stream"
    if media_type in INLINE_UNSAFE_TYPES:
        media_type = "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=job.filename or path.name,
        content_disposition_type="attachment",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
            "Cache-Control": "private, no-store",
        },
    )
