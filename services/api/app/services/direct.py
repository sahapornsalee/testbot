"""Direct file inspection and segmented, resumable downloads (IDM-style).

A download is split into byte-range segments fetched over parallel connections when the
server supports ranges and the size is known. Progress per segment is persisted next to the
partial file, so a paused (or interrupted) job resumes where it stopped. Every connection
still goes through the SSRF-guarded client.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from pathlib import Path

import httpx

from app.core.errors import AppError, ErrorCode
from app.services import file_types
from app.services.safe_http import map_transport_error, open_stream

SNIFF_BYTES = 8192
MAX_RESUME_ATTEMPTS = 3
_CONTENT_RANGE = re.compile(r"^bytes (\d+)-(\d+)/(\d+|\*)$")


@dataclass
class HttpInspection:
    url: str
    final_url: str
    redirect_chain: list[str]
    status_code: int
    declared_content_type: str | None
    content_type: str
    category: file_types.Category
    size_bytes: int | None
    filename: str
    extension: str | None
    accepts_ranges: bool


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value.strip())
    except ValueError:
        return None
    return parsed if parsed >= 0 else None


def _total_size(response: httpx.Response) -> int | None:
    if response.status_code == 206:
        match = _CONTENT_RANGE.match(response.headers.get("content-range", ""))
        if match and match.group(3) != "*":
            return int(match.group(3))
        return None
    if response.headers.get("content-encoding", "identity").lower() not in ("", "identity"):
        return None  # Content-Length describes the encoded size, not the file size
    return _parse_int(response.headers.get("content-length"))


def _choose_filename(response: httpx.Response, final_url: str, mime: str) -> str:
    raw = file_types.filename_from_content_disposition(
        response.headers.get("content-disposition")
    ) or file_types.filename_from_url(final_url)
    return file_types.sanitize_filename(raw, mime=mime)


async def inspect_http(client: httpx.AsyncClient, url: str, max_redirects: int) -> HttpInspection:
    """Fetch only headers and the first few KB. Never reads the whole body."""
    async with open_stream(
        client, url, max_redirects=max_redirects, headers={"Range": f"bytes=0-{SNIFF_BYTES - 1}"}
    ) as result:
        response = result.response
        if response.status_code >= 400:
            raise AppError(
                ErrorCode.SOURCE_UNAVAILABLE, f"The source answered HTTP {response.status_code}"
            )
        head = b""
        try:
            async for chunk in response.aiter_bytes():
                head += chunk
                if len(head) >= SNIFF_BYTES:
                    break
        except httpx.HTTPError as exc:
            if not head:
                raise map_transport_error(exc) from exc

        declared = file_types.normalize_mime(response.headers.get("content-type"))
        sniffed = file_types.sniff_mime(head[:SNIFF_BYTES])
        provisional_name = file_types.filename_from_content_disposition(
            response.headers.get("content-disposition")
        ) or file_types.filename_from_url(result.final_url)
        mime = file_types.resolve_mime(declared, sniffed, provisional_name)
        filename = _choose_filename(response, result.final_url, mime)
        accepts_ranges = response.status_code == 206 or (
            response.headers.get("accept-ranges", "").lower() == "bytes"
        )
        return HttpInspection(
            url=url,
            final_url=result.final_url,
            redirect_chain=result.redirect_chain,
            status_code=response.status_code,
            declared_content_type=declared,
            content_type=mime,
            category=file_types.categorize(mime),
            size_bytes=_total_size(response),
            filename=filename,
            extension=Path(filename).suffix.lower() or None,
            accepts_ranges=accepts_ranges,
        )


ProgressCallback = Callable[[int, int | None], Awaitable[None]]
STATE_SAVE_INTERVAL = 1.0


@dataclass
class DirectResult:
    path: Path
    size: int
    filename: str
    content_type: str
    category: file_types.Category
    connections: int = 1


@dataclass
class Segment:
    start: int
    end: int | None  # inclusive; None = until the end of an unknown-length body
    done: int = 0

    @property
    def remaining(self) -> int | None:
        return None if self.end is None else self.end - self.start + 1 - self.done


@dataclass
class DownloadState:
    """Resume information stored as ``<job>.state.json`` beside ``<job>.part``."""

    url: str
    size: int | None
    validator: str | None
    filename: str
    declared: str | None
    ranged: bool
    segments: list[Segment] = field(default_factory=list)

    def save(self, path: Path) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(asdict(self)), encoding="utf-8")
        os.replace(tmp, path)

    @classmethod
    def load(cls, path: Path) -> DownloadState | None:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            data["segments"] = [Segment(**seg) for seg in data["segments"]]
            return cls(**data)
        except (OSError, ValueError, TypeError, KeyError):
            return None


class _SourceChanged(Exception):
    """The file on the server changed since the partial download started."""


def plan_segments(size: int, connections: int, min_segment: int) -> list[Segment]:
    count = max(1, min(connections, size // max(min_segment, 1)))
    step = size // count
    segments = []
    for index in range(count):
        start = index * step
        end = size - 1 if index == count - 1 else start + step - 1
        segments.append(Segment(start, end))
    return segments


def _validator(response: httpx.Response) -> str | None:
    etag = response.headers.get("etag")
    if etag and not etag.startswith("W/"):
        return etag
    return response.headers.get("last-modified")


def _first_error(group: BaseExceptionGroup) -> BaseException:
    for exc in group.exceptions:
        if isinstance(exc, BaseExceptionGroup):
            return _first_error(exc)
        if not isinstance(exc, asyncio.CancelledError):
            return exc
    return group.exceptions[0]


async def download_direct(
    client: httpx.AsyncClient,
    url: str,
    destination: Path,
    *,
    max_bytes: int,
    max_redirects: int,
    on_progress: ProgressCallback,
    ensure_capacity: Callable[[int], None],
    on_metadata: Callable[[str, str | None], None] | None = None,
    connections: int = 1,
    min_segment_bytes: int = 1024 * 1024,
    state_path: Path | None = None,
    on_plan: Callable[[int], None] | None = None,
) -> DirectResult:
    """Download ``url`` into ``destination``.

    Uses up to ``connections`` parallel range requests when possible, resumes from
    ``state_path`` when a matching partial download exists, retries each segment up to
    ``MAX_RESUME_ATTEMPTS`` times, and enforces ``max_bytes`` throughout.
    """
    state_path = state_path or destination.with_name(destination.name + ".state.json")
    for _ in range(2):  # a second pass only if the server-side file changed mid-way
        try:
            return await _download(
                client,
                url,
                destination,
                state_path,
                max_bytes=max_bytes,
                max_redirects=max_redirects,
                on_progress=on_progress,
                ensure_capacity=ensure_capacity,
                on_metadata=on_metadata,
                connections=connections,
                min_segment_bytes=min_segment_bytes,
                on_plan=on_plan,
            )
        except _SourceChanged:
            state_path.unlink(missing_ok=True)
            destination.unlink(missing_ok=True)
    raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The file keeps changing on the server")


async def _probe(
    client: httpx.AsyncClient, url: str, max_redirects: int, max_bytes: int
) -> tuple[str, httpx.Response, int | None, bool, str | None, str, str | None]:
    """Read the response headers of a ``Range: bytes=0-`` request, then drop the body."""
    async with open_stream(
        client, url, max_redirects=max_redirects, headers={"Range": "bytes=0-"}
    ) as result:
        response = result.response
        if response.status_code not in (200, 206):
            raise AppError(
                ErrorCode.SOURCE_UNAVAILABLE, f"The source answered HTTP {response.status_code}"
            )
        declared = file_types.normalize_mime(response.headers.get("content-type"))
        if declared == "text/html":
            raise AppError(
                ErrorCode.UNSUPPORTED_CONTENT,
                "The URL points to a web page, not a downloadable file",
            )
        size = _total_size(response)
        if size is not None and size > max_bytes:
            raise AppError(ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit")
        encoding = response.headers.get("content-encoding", "identity").lower()
        match = _CONTENT_RANGE.match(response.headers.get("content-range", ""))
        ranged = (
            response.status_code == 206
            and match is not None
            and int(match.group(1)) == 0
            and size is not None
            and encoding in ("", "identity")
        )
        filename = _choose_filename(
            response, result.final_url, declared or "application/octet-stream"
        )
        return result.final_url, response, size, ranged, _validator(response), filename, declared


async def _download(
    client: httpx.AsyncClient,
    url: str,
    destination: Path,
    state_path: Path,
    *,
    max_bytes: int,
    max_redirects: int,
    on_progress: ProgressCallback,
    ensure_capacity: Callable[[int], None],
    on_metadata: Callable[[str, str | None], None] | None,
    connections: int,
    min_segment_bytes: int,
    on_plan: Callable[[int], None] | None,
) -> DirectResult:
    final_url, _resp, size, ranged, validator, filename, declared = await _probe(
        client, url, max_redirects, max_bytes
    )
    if on_metadata is not None:
        on_metadata(filename, declared)

    state = DownloadState.load(state_path) if destination.exists() else None
    resumable = (
        state is not None
        and ranged
        and state.ranged
        and state.size == size
        and validator is not None
        and state.validator == validator
        and destination.stat().st_size == size
    )
    if not resumable:
        segments = (
            plan_segments(size, connections, min_segment_bytes)  # type: ignore[arg-type]
            if ranged
            else [Segment(0, size - 1 if size else None)]
        )
        state = DownloadState(final_url, size, validator, filename, declared, ranged, segments)
        ensure_capacity(size or 0)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as handle:
            if ranged and size:
                handle.truncate(size)  # pre-allocate so segments can write in place
        if ranged:
            state.save(state_path)
    else:
        assert state is not None
        state.url = final_url
        ensure_capacity(sum(seg.remaining or 0 for seg in state.segments))
    assert state is not None
    if on_plan is not None:
        on_plan(len(state.segments))

    total_done = sum(seg.done for seg in state.segments)
    last_save = time.monotonic()
    await on_progress(total_done, size)

    async def add_progress(amount: int) -> None:
        nonlocal total_done, last_save
        total_done += amount
        if total_done > max_bytes:
            raise AppError(ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit")
        if state.ranged and time.monotonic() - last_save >= STATE_SAVE_INTERVAL:
            last_save = time.monotonic()
            state.save(state_path)
        await on_progress(total_done, size)

    async def fetch_segment(seg: Segment) -> None:
        attempts = 0
        while seg.end is None or seg.remaining:
            position = seg.start + seg.done
            headers: dict[str, str] = {}
            if state.ranged:
                headers["Range"] = f"bytes={position}-{seg.end}"
                if validator:
                    headers["If-Range"] = validator
            elif seg.done:
                raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The connection was interrupted")
            try:
                async with open_stream(
                    client, state.url, max_redirects=max_redirects, headers=headers
                ) as result:
                    response = result.response
                    if state.ranged:
                        match = _CONTENT_RANGE.match(response.headers.get("content-range", ""))
                        if response.status_code == 200:
                            raise _SourceChanged()
                        if (
                            response.status_code != 206
                            or not match
                            or int(match.group(1)) != position
                        ):
                            raise AppError(
                                ErrorCode.INCOMPLETE_DOWNLOAD,
                                "The source stopped supporting resumable downloads",
                            )
                    elif response.status_code != 200:
                        raise AppError(
                            ErrorCode.SOURCE_UNAVAILABLE,
                            f"The source answered HTTP {response.status_code}",
                        )
                    with destination.open("r+b") as handle:
                        handle.seek(position)
                        async for chunk in response.aiter_bytes():
                            if seg.end is not None:
                                chunk = chunk[: seg.remaining]
                            if not chunk:
                                break
                            handle.write(chunk)
                            seg.done += len(chunk)
                            await add_progress(len(chunk))
                    if seg.end is None:
                        return
                    if seg.remaining:
                        raise httpx.RemoteProtocolError("segment ended early")
            except (AppError, _SourceChanged):
                raise
            except (httpx.TransportError, httpx.DecodingError) as exc:
                attempts += 1
                if not state.ranged or attempts > MAX_RESUME_ATTEMPTS:
                    if isinstance(exc, httpx.TimeoutException):
                        raise AppError(
                            ErrorCode.DOWNLOAD_TIMEOUT, "The download timed out"
                        ) from exc
                    raise AppError(
                        ErrorCode.INCOMPLETE_DOWNLOAD, "The connection was interrupted"
                    ) from exc
                await asyncio.sleep(min(0.25 * attempts, 1.0))

    try:
        async with asyncio.TaskGroup() as group:
            for seg in state.segments:
                if seg.end is None or seg.remaining:
                    group.create_task(fetch_segment(seg))
    except BaseExceptionGroup as group_error:
        raise _first_error(group_error) from None
    finally:
        # Persist progress even when cancelled (pause) or failed, so a resume can continue.
        if state.ranged:
            with contextlib.suppress(OSError):
                state.save(state_path)

    written = destination.stat().st_size if size is None else total_done
    if size is not None and (written != size or destination.stat().st_size != size):
        raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The downloaded size does not match")
    if written == 0 and size != 0:
        raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The source returned an empty body")
    state_path.unlink(missing_ok=True)

    with destination.open("rb") as handle:
        head = handle.read(SNIFF_BYTES)
    mime = file_types.resolve_mime(declared, file_types.sniff_mime(head), filename)
    if mime == "text/html":
        raise AppError(
            ErrorCode.UNSUPPORTED_CONTENT, "The URL points to a web page, not a downloadable file"
        )
    final_name = file_types.sanitize_filename(filename, mime=mime)
    return DirectResult(
        path=destination,
        size=written,
        filename=final_name,
        content_type=mime,
        category=file_types.categorize(mime),
        connections=len(state.segments),
    )
