"""In-process job runner.

The ``JobQueue`` protocol is the seam for scaling out: the API only calls
``create_job`` / ``cancel`` / ``start`` / ``stop``. A future implementation can push job
IDs to Redis/RQ/Celery and run ``JobRunner.execute`` in a separate worker container
with restricted egress, without changing the API routes. See services/worker/README.md.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Protocol

import httpx

from app.core.config import Settings
from app.core.errors import AppError, ErrorCode
from app.core.url_policy import DestinationPolicy, validate_url
from app.schemas.models import CreateDownloadRequest, DownloadMode, JobStatus
from app.services import file_types, media
from app.services.direct import download_direct
from app.services.job_store import (
    ACTIVE_STATUSES,
    JobRecord,
    JobStore,
    utcnow,
)
from app.services.storage import Storage

logger = logging.getLogger("universal_downloader.jobs")
PROGRESS_WRITE_INTERVAL = 0.5
PAUSABLE_STATUSES = frozenset({JobStatus.QUEUED, JobStatus.INSPECTING, JobStatus.DOWNLOADING})
# Paused jobs keep their partial data at least this long, even with a short TTL.
MIN_PAUSED_RETENTION = timedelta(hours=24)


class JobQueue(Protocol):
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    def create_job(self, owner: str, request: CreateDownloadRequest) -> JobRecord: ...
    def cancel(self, owner: str, job_id: str) -> JobRecord: ...
    def pause(self, owner: str, job_id: str) -> JobRecord: ...
    def resume(self, owner: str, job_id: str) -> JobRecord: ...


class JobRunner:
    def __init__(
        self,
        settings: Settings,
        store: JobStore,
        storage: Storage,
        policy: DestinationPolicy,
        client_factory: Callable[[], httpx.AsyncClient],
    ) -> None:
        self.settings = settings
        self.store = store
        self.storage = storage
        self.policy = policy
        self._client_factory = client_factory
        self._semaphore = asyncio.Semaphore(settings.max_concurrent_jobs)
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._cancel_requested: set[str] = set()
        self._pause_requested: set[str] = set()
        self._cleanup_task: asyncio.Task[None] | None = None

    # -- lifecycle ---------------------------------------------------------------
    async def start(self) -> None:
        for job in self.store.list_by_status(ACTIVE_STATUSES):
            if job.mode == DownloadMode.DIRECT and job.status in PAUSABLE_STATUSES:
                # Direct downloads keep their partial data: pause them so the user can resume.
                self.store.update(job.id, status=JobStatus.PAUSED, paused_at=utcnow())
                continue
            self.store.update(
                job.id,
                status=JobStatus.FAILED,
                error_code=ErrorCode.INTERRUPTED.value,
                error_message="The server restarted while this job was running",
                finished_at=utcnow(),
            )
            self.storage.remove_job_files(job.id)
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        if self._cleanup_task:
            self._cleanup_task.cancel()
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        if self._cleanup_task:
            with contextlib.suppress(asyncio.CancelledError):
                await self._cleanup_task

    async def wait_idle(self) -> None:
        """Wait until all running jobs finish (used by tests)."""
        while self._tasks:
            await asyncio.gather(*list(self._tasks.values()), return_exceptions=True)

    # -- API facing ----------------------------------------------------------------
    def create_job(self, owner: str, request: CreateDownloadRequest) -> JobRecord:
        validated = validate_url(request.url)
        if request.mode == DownloadMode.MEDIA and not request.format_id:
            raise AppError(ErrorCode.FORMAT_NOT_AVAILABLE, "A format must be selected for media")
        if self.store.count_active_for_owner(owner) >= self.settings.max_active_jobs_per_owner:
            raise AppError(ErrorCode.QUOTA_EXCEEDED, "Too many jobs in the queue")
        job = self.store.insert(
            JobRecord(
                id=uuid.uuid4().hex,
                owner=owner,
                status=JobStatus.QUEUED,
                mode=request.mode,
                source_url=validated.url,
                source_host=validated.host,
                format_id=request.format_id if request.mode == DownloadMode.MEDIA else None,
                merge_audio=request.merge_audio,
            )
        )
        self._tasks[job.id] = asyncio.create_task(self._run(job.id), name=f"job-{job.id}")
        return job

    def cancel(self, owner: str, job_id: str) -> JobRecord:
        job = self.store.get_for_owner(job_id, owner)
        if job.status == JobStatus.PAUSED:
            self.storage.remove_job_files(job_id)
            return self.store.update(job_id, status=JobStatus.CANCELLED, finished_at=utcnow())
        if job.status not in ACTIVE_STATUSES:
            raise AppError(ErrorCode.INVALID_STATE, "Only queued or running jobs can be cancelled")
        self._cancel_requested.add(job_id)
        task = self._tasks.get(job_id)
        if task is not None and not task.done():
            task.cancel()
        else:
            job = self._finish(job_id, JobStatus.CANCELLED)
        return job

    def pause(self, owner: str, job_id: str) -> JobRecord:
        job = self.store.get_for_owner(job_id, owner)
        if job.mode != DownloadMode.DIRECT:
            raise AppError(ErrorCode.INVALID_STATE, "Media downloads cannot be paused")
        if job.status not in PAUSABLE_STATUSES:
            raise AppError(ErrorCode.INVALID_STATE, "Only queued or downloading jobs can be paused")
        task = self._tasks.get(job_id)
        if task is not None and not task.done():
            self._pause_requested.add(job_id)
            task.cancel()
            return job
        return self.store.update(job_id, status=JobStatus.PAUSED, paused_at=utcnow())

    def resume(self, owner: str, job_id: str) -> JobRecord:
        job = self.store.get_for_owner(job_id, owner)
        if job.status != JobStatus.PAUSED:
            raise AppError(ErrorCode.INVALID_STATE, "Only paused jobs can be resumed")
        job = self.store.update(
            job_id, status=JobStatus.QUEUED, paused_at=None, error_code=None, error_message=None
        )
        self._tasks[job_id] = asyncio.create_task(self._run(job_id), name=f"job-{job_id}")
        return job

    # -- execution -------------------------------------------------------------------
    def _finish(self, job_id: str, status: JobStatus, error: AppError | None = None) -> JobRecord:
        current = self.store.get(job_id)
        if current is None or current.status not in ACTIVE_STATUSES:
            return current  # type: ignore[return-value]
        return self.store.update(
            job_id,
            status=status,
            error_code=error.code.value if error else None,
            error_message=error.message if error else None,
            finished_at=utcnow(),
        )

    def _progress_writer(self, job_id: str):  # noqa: ANN202
        last_write = 0.0

        async def on_progress(downloaded: int, total: int | None) -> None:
            nonlocal last_write
            now = time.monotonic()
            if now - last_write >= PROGRESS_WRITE_INTERVAL or (total and downloaded >= total):
                last_write = now
                changes: dict[str, object] = {"downloaded_bytes": downloaded}
                if total is not None:
                    changes["expected_size"] = total
                self.store.update(job_id, **changes)
            await asyncio.sleep(0)  # cancellation point for very fast streams

        return on_progress

    async def _run(self, job_id: str) -> None:
        try:
            async with self._semaphore:
                async with asyncio.timeout(self.settings.job_timeout_seconds):
                    await self.execute(job_id)
        except asyncio.CancelledError:
            if job_id in self._pause_requested:
                current = self.store.get(job_id)
                if current is not None and current.status in PAUSABLE_STATUSES:
                    self.store.update(job_id, status=JobStatus.PAUSED, paused_at=utcnow())
            elif job_id in self._cancel_requested:
                self._finish(job_id, JobStatus.CANCELLED)
            else:
                self._finish(
                    job_id,
                    JobStatus.FAILED,
                    AppError(
                        ErrorCode.INTERRUPTED, "The server stopped while this job was running"
                    ),
                )
                raise
        except TimeoutError:
            self._finish(job_id, JobStatus.FAILED, AppError(ErrorCode.DOWNLOAD_TIMEOUT))
        except AppError as exc:
            self._finish(job_id, JobStatus.FAILED, exc)
        except Exception:
            logger.exception("job failed unexpectedly", extra={"job_id": job_id})
            self._finish(job_id, JobStatus.FAILED, AppError(ErrorCode.INTERNAL_ERROR))
        finally:
            final = self.store.get(job_id)
            if final is not None and final.status == JobStatus.PAUSED:
                pass  # keep the partial file and its resume state
            elif final is None or final.status != JobStatus.COMPLETED:
                self.storage.remove_job_files(job_id)
            else:
                self.storage.remove_job_files_temp_only(job_id)
            self._tasks.pop(job_id, None)
            self._cancel_requested.discard(job_id)
            self._pause_requested.discard(job_id)

    async def execute(self, job_id: str) -> None:
        job = self.store.get(job_id)
        if job is None or job.status != JobStatus.QUEUED:
            return
        self.store.update(
            job_id, status=JobStatus.INSPECTING, started_at=job.started_at or utcnow()
        )
        await self.policy.validate(job.source_url)
        if job.mode == DownloadMode.DIRECT:
            await self._execute_direct(job)
        else:
            await self._execute_media(job)

    async def _execute_direct(self, job: JobRecord) -> None:
        self.store.update(job.id, status=JobStatus.DOWNLOADING)
        temp_file = self.storage.temp_path(job.id)
        async with self._client_factory() as client:
            result = await download_direct(
                client,
                job.source_url,
                temp_file,
                max_bytes=self.settings.max_file_size_bytes,
                max_redirects=self.settings.max_redirects,
                on_progress=self._progress_writer(job.id),
                ensure_capacity=self.storage.ensure_capacity,
                on_metadata=lambda name, mime: self.store.update(
                    job.id, filename=name, content_type=mime
                ),
                connections=self.settings.max_connections_per_download,
                min_segment_bytes=self.settings.min_segment_bytes,
                state_path=self.storage.temp_path(job.id, ".state.json"),
                on_plan=lambda count: self.store.update(job.id, connections=count),
            )
        self.store.update(
            job.id,
            status=JobStatus.PROCESSING,
            downloaded_bytes=result.size,
            filename=result.filename,
            content_type=result.content_type,
            category=result.category,
        )
        self._commit(job.id, temp_file, result.filename, result.size)

    async def _execute_media(self, job: JobRecord) -> None:
        ffmpeg = media.ffmpeg_path(self.settings.ffmpeg_location)
        info = await media.inspect_media(
            job.source_url, self.settings.media_inspect_timeout_seconds, ffmpeg
        )
        selected = next((f for f in info.formats if f.format_id == job.format_id), None)
        if selected is None:
            raise AppError(ErrorCode.FORMAT_NOT_AVAILABLE, "The selected format is not available")
        selector = selected.format_id
        if job.merge_audio and selected.kind == "video":
            if ffmpeg is None:
                raise AppError(ErrorCode.MEDIA_TOOL_MISSING, "FFmpeg is required to merge audio")
            selector = f"{selected.format_id}+bestaudio"
        expected = selected.filesize or selected.filesize_approx
        self.storage.ensure_capacity(expected or 0)
        self.store.update(
            job.id,
            status=JobStatus.DOWNLOADING,
            expected_size=expected,
            category="audio" if selected.kind == "audio" else "video",
        )
        work_dir = self.storage.temp_job_dir(job.id)
        result = await media.download_media(
            job.source_url,
            selector,
            work_dir,
            max_bytes=self.settings.max_file_size_bytes,
            ffmpeg=ffmpeg,
            on_progress=self._progress_writer(job.id),
        )
        filename = file_types.sanitize_filename(
            f"{info.title or 'media'}{result.ext}", fallback_stem="media"
        )
        with result.path.open("rb") as handle:
            head = handle.read(8192)
        mime = file_types.resolve_mime(None, file_types.sniff_mime(head), filename)
        self.store.update(
            job.id,
            status=JobStatus.PROCESSING,
            downloaded_bytes=result.size,
            filename=filename,
            content_type=mime,
        )
        self._commit(job.id, result.path, filename, result.size)

    def _commit(self, job_id: str, source, filename: str, size: int) -> None:  # noqa: ANN001
        final = self.storage.commit(source, job_id, filename)
        # Only report Completed once the final file exists with the expected size.
        if not final.is_file() or final.stat().st_size != size:
            raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The output file could not be verified")
        self.store.update(
            job_id,
            status=JobStatus.COMPLETED,
            actual_size=size,
            file_path=self.storage.relative(final),
            finished_at=utcnow(),
        )

    # -- retention -----------------------------------------------------------------
    def cleanup_once(self) -> int:
        ttl = timedelta(hours=self.settings.temp_file_ttl_hours)
        now = utcnow()
        expired = 0
        for job in self.store.list_by_status(frozenset({JobStatus.COMPLETED})):
            if job.finished_at and now - job.finished_at >= ttl:
                self.storage.remove_job_files(job.id)
                self.store.update(job.id, status=JobStatus.EXPIRED, file_path=None)
                expired += 1
        paused_ttl = max(ttl, MIN_PAUSED_RETENTION)
        paused = self.store.list_by_status(frozenset({JobStatus.PAUSED}))
        for job in paused:
            if job.paused_at and now - job.paused_at >= paused_ttl:
                self.storage.remove_job_files(job.id)
                self.store.update(job.id, status=JobStatus.EXPIRED)
                expired += 1
        keep = set(self._tasks) | {job.id for job in paused}
        self.storage.remove_stale_temp(ttl.total_seconds(), keep=keep)
        return expired

    async def _cleanup_loop(self) -> None:
        while True:
            try:
                self.cleanup_once()
            except Exception:
                logger.exception("cleanup failed")
            await asyncio.sleep(self.settings.cleanup_interval_seconds)
