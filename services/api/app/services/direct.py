"""Direct file inspection and streaming download."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
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


@dataclass
class DirectResult:
    path: Path
    size: int
    filename: str
    content_type: str
    category: file_types.Category


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
) -> DirectResult:
    """Stream ``url`` into ``destination`` enforcing size limits.

    If the connection drops and the server supports byte ranges, resume from the
    current offset (validated via Content-Range) up to ``MAX_RESUME_ATTEMPTS`` times.
    """
    written = 0
    expected: int | None = None
    filename: str | None = None
    declared: str | None = None
    head = b""
    can_resume = False
    attempts = 0
    target_url = url

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        while True:
            headers = {"Range": f"bytes={written}-"} if written else None
            try:
                async with open_stream(
                    client, target_url, max_redirects=max_redirects, headers=headers
                ) as result:
                    response = result.response
                    if written:
                        match = _CONTENT_RANGE.match(response.headers.get("content-range", ""))
                        if (
                            response.status_code != 206
                            or not match
                            or int(match.group(1)) != written
                        ):
                            raise AppError(
                                ErrorCode.INCOMPLETE_DOWNLOAD,
                                "The source does not support resuming this download",
                            )
                    else:
                        if response.status_code != 200:
                            raise AppError(
                                ErrorCode.SOURCE_UNAVAILABLE,
                                f"The source answered HTTP {response.status_code}",
                            )
                        target_url = result.final_url  # resume against the validated final URL
                        declared = file_types.normalize_mime(response.headers.get("content-type"))
                        if declared == "text/html":
                            raise AppError(
                                ErrorCode.UNSUPPORTED_CONTENT,
                                "The URL points to a web page, not a downloadable file",
                            )
                        expected = _total_size(response)
                        if expected is not None and expected > max_bytes:
                            raise AppError(
                                ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit"
                            )
                        ensure_capacity(expected or 0)
                        encoding = response.headers.get("content-encoding", "identity").lower()
                        can_resume = (
                            response.headers.get("accept-ranges", "").lower() == "bytes"
                            and encoding in ("", "identity")
                            and expected is not None
                        )
                        filename = _choose_filename(
                            response, result.final_url, declared or "application/octet-stream"
                        )
                        if on_metadata is not None:
                            on_metadata(filename, declared)
                        await on_progress(0, expected)

                    async for chunk in response.aiter_bytes():
                        written += len(chunk)
                        if written > max_bytes:
                            raise AppError(
                                ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit"
                            )
                        if len(head) < SNIFF_BYTES:
                            head += chunk[: SNIFF_BYTES - len(head)]
                        handle.write(chunk)
                        await on_progress(written, expected)
                break
            except AppError:
                raise
            except (httpx.TransportError, httpx.DecodingError) as exc:
                attempts += 1
                if not can_resume or attempts > MAX_RESUME_ATTEMPTS:
                    if isinstance(exc, httpx.TimeoutException):
                        raise AppError(
                            ErrorCode.DOWNLOAD_TIMEOUT, "The download timed out"
                        ) from exc
                    raise AppError(
                        ErrorCode.INCOMPLETE_DOWNLOAD, "The connection was interrupted"
                    ) from exc
                handle.flush()

        handle.flush()

    if expected is not None and written != expected:
        raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The downloaded size does not match")
    if written == 0 and expected not in (0,):
        raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The source returned an empty body")

    sniffed = file_types.sniff_mime(head)
    mime = file_types.resolve_mime(declared, sniffed, filename)
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
    )
