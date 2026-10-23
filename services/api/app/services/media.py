"""yt-dlp and FFmpeg integration.

yt-dlp always runs as a subprocess with an argument list (never a shell string), with
``--no-config`` so local config files cannot inject options, and with ``--`` before the
URL so a URL can never be parsed as an option. No cookies or credentials are passed.

Security note: yt-dlp performs its own network requests (including to CDNs chosen by
the site), which do not go through the pinned transport in ``safe_http``. We therefore
only hand URLs to yt-dlp when a *dedicated* extractor (not the generic one) matches,
after the hostname passed ``DestinationPolicy``. Production deployments must also
restrict the worker's egress at the network layer — see docs/SECURITY.md.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import shutil
import subprocess  # noqa: S404 - used with argument lists only
import sys
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.errors import AppError, ErrorCode
from app.schemas.models import MediaFormat, MediaInfo

PROGRESS_PREFIX = "UDPROG"
_BASE_ARGS = ["--no-config", "--no-playlist", "--no-cache-dir", "--no-warnings", "--no-color"]


def ytdlp_command() -> list[str]:
    return [sys.executable, "-m", "yt_dlp"]


@lru_cache
def ytdlp_version() -> str | None:
    try:
        from yt_dlp.version import __version__
    except ImportError:
        return None
    return str(__version__)


def ffmpeg_path(configured: str | None) -> str | None:
    if configured:
        candidate = Path(configured)
        if candidate.is_dir():
            for name in ("ffmpeg", "ffmpeg.exe"):
                if (candidate / name).is_file():
                    return str(candidate / name)
            return None
        return str(candidate) if candidate.is_file() else None
    return shutil.which("ffmpeg")


@lru_cache(maxsize=8)
def ffmpeg_version(path: str | None) -> str | None:
    if not path:
        return None
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argument list
            [path, "-version"], capture_output=True, text=True, timeout=10, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    first_line = completed.stdout.splitlines()[0] if completed.stdout else ""
    parts = first_line.split()
    return parts[2] if len(parts) > 2 and parts[0] == "ffmpeg" else (first_line or None)


@lru_cache(maxsize=1)
def _extractors() -> tuple[Any, ...]:
    from yt_dlp.extractor import gen_extractor_classes

    return tuple(ie for ie in gen_extractor_classes() if ie.ie_key() != "Generic")


def dedicated_extractor(url: str) -> str | None:
    """Return the yt-dlp extractor key for ``url`` if a site-specific one matches."""
    if ytdlp_version() is None:
        return None
    for extractor in _extractors():
        try:
            if extractor.suitable(url) and getattr(extractor, "_WORKING", True):
                return str(extractor.ie_key())
        except Exception:  # noqa: BLE001,S112 - a broken extractor regex must not break us
            continue
    return None


def _kind(fmt: dict[str, Any]) -> str | None:
    vcodec = fmt.get("vcodec")
    acodec = fmt.get("acodec")
    has_video = vcodec != "none" and (vcodec is not None or fmt.get("height") is not None)
    has_audio = acodec != "none" and (acodec is not None or vcodec is None)
    if vcodec is None and acodec is None and fmt.get("height") is None:
        has_video = fmt.get("video_ext", "none") != "none"
        has_audio = True
    if has_video and has_audio:
        return "video+audio"
    if has_video:
        return "video"
    if has_audio:
        return "audio"
    return None


def parse_media_info(data: dict[str, Any], ffmpeg_available: bool) -> MediaInfo:
    """Turn yt-dlp JSON into the formats that really exist. Nothing is invented."""
    formats: list[MediaFormat] = []
    for fmt in data.get("formats") or []:
        format_id = str(fmt.get("format_id") or "")
        if not format_id or fmt.get("has_drm") or fmt.get("ext") in ("mhtml", None):
            continue
        if not all(ch.isalnum() or ch in "_.-" for ch in format_id) or len(format_id) > 64:
            continue
        kind = _kind(fmt)
        if kind is None:
            continue
        formats.append(
            MediaFormat(
                format_id=format_id,
                ext=fmt.get("ext"),
                kind=kind,  # type: ignore[arg-type]
                width=fmt.get("width"),
                height=fmt.get("height"),
                fps=fmt.get("fps"),
                vcodec=None if fmt.get("vcodec") == "none" else fmt.get("vcodec"),
                acodec=None if fmt.get("acodec") == "none" else fmt.get("acodec"),
                abr=fmt.get("abr"),
                tbr=fmt.get("tbr"),
                filesize=fmt.get("filesize"),
                filesize_approx=fmt.get("filesize_approx"),
                note=fmt.get("format_note"),
            )
        )

    def score(item: MediaFormat) -> tuple[int, float, float]:
        return (item.height or 0, item.fps or 0, item.tbr or item.abr or 0)

    combined = [f for f in formats if f.kind == "video+audio"]
    video_only = [f for f in formats if f.kind == "video"]
    audio_only = [f for f in formats if f.kind == "audio"]
    candidates = combined + (video_only if ffmpeg_available and audio_only else [])
    best = max(candidates, key=score, default=None) or max(audio_only, key=score, default=None)

    return MediaInfo(
        title=data.get("title"),
        duration_seconds=data.get("duration"),
        uploader=data.get("uploader") or data.get("channel"),
        extractor=data.get("extractor_key") or data.get("extractor"),
        thumbnail=data.get("thumbnail"),
        formats=formats,
        best_format_id=best.format_id if best else None,
        ffmpeg_available=ffmpeg_available,
    )


async def _run(args: list[str], timeout: float) -> tuple[int, bytes, bytes]:
    process = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except (TimeoutError, asyncio.CancelledError):
        with contextlib.suppress(ProcessLookupError):
            process.kill()
        await process.wait()
        raise
    return process.returncode or 0, stdout, stderr


def _error_from_stderr(stderr: str) -> AppError:
    lowered = stderr.lower()
    if "drm" in lowered:
        return AppError(ErrorCode.UNSUPPORTED_SOURCE, "This media is DRM protected")
    if "sign in" in lowered or "login" in lowered or "private" in lowered:
        return AppError(
            ErrorCode.UNSUPPORTED_SOURCE, "This media requires an account or is private"
        )
    if "requested format is not available" in lowered:
        return AppError(ErrorCode.FORMAT_NOT_AVAILABLE, "The selected format is not available")
    if "file is larger than max-filesize" in lowered:
        return AppError(ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit")
    if "unsupported url" in lowered:
        return AppError(ErrorCode.UNSUPPORTED_SOURCE, "This website is not supported")
    return AppError(ErrorCode.SOURCE_UNAVAILABLE, "The media could not be read from the source")


async def inspect_media(url: str, timeout: float, ffmpeg: str | None) -> MediaInfo:
    if ytdlp_version() is None:
        raise AppError(ErrorCode.MEDIA_TOOL_MISSING, "yt-dlp is not installed")
    args = [*ytdlp_command(), *_BASE_ARGS, "--dump-single-json", "--skip-download", "--", url]
    try:
        code, stdout, stderr = await _run(args, timeout)
    except TimeoutError as exc:
        raise AppError(ErrorCode.DOWNLOAD_TIMEOUT, "Media inspection timed out") from exc
    if code != 0:
        raise _error_from_stderr(stderr.decode("utf-8", "replace"))
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise AppError(ErrorCode.MEDIA_PROCESSING_FAILED, "Unexpected media metadata") from exc
    if data.get("_type") == "playlist":
        raise AppError(ErrorCode.UNSUPPORTED_SOURCE, "Playlists are not supported yet")
    return parse_media_info(data, ffmpeg_available=ffmpeg is not None)


@dataclass
class MediaResult:
    path: Path
    size: int
    ext: str


def build_download_args(
    url: str,
    format_selector: str,
    output_dir: Path,
    max_bytes: int,
    ffmpeg: str | None,
) -> list[str]:
    args = [
        *ytdlp_command(),
        *_BASE_ARGS,
        "--newline",
        "--no-part",
        "--no-mtime",
        "--max-filesize",
        str(max_bytes),
        "-f",
        format_selector,
        "-o",
        str(output_dir / "media.%(ext)s"),
        "--progress-template",
        f"download:{PROGRESS_PREFIX} %(progress.downloaded_bytes)s "
        "%(progress.total_bytes)s %(progress.total_bytes_estimate)s",
        "--print",
        "after_move:filepath",
    ]
    if ffmpeg:
        args += ["--ffmpeg-location", ffmpeg, "--merge-output-format", "mp4/mkv"]
    return [*args, "--", url]


def parse_progress(line: str) -> tuple[int, int | None] | None:
    if not line.startswith(PROGRESS_PREFIX):
        return None
    parts = line.split()
    if len(parts) < 4:
        return None

    def as_int(value: str) -> int | None:
        try:
            return int(float(value))
        except ValueError:
            return None

    downloaded = as_int(parts[1])
    total = as_int(parts[2]) or as_int(parts[3])
    if downloaded is None:
        return None
    return downloaded, total


async def download_media(
    url: str,
    format_selector: str,
    output_dir: Path,
    *,
    max_bytes: int,
    ffmpeg: str | None,
    on_progress: Callable[[int, int | None], Awaitable[None]],
) -> MediaResult:
    args = build_download_args(url, format_selector, output_dir, max_bytes, ffmpeg)
    process = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    final_path: str | None = None
    stderr_task = asyncio.create_task(process.stderr.read())  # type: ignore[union-attr]
    try:
        assert process.stdout is not None
        async for raw in process.stdout:
            line = raw.decode("utf-8", "replace").strip()
            progress = parse_progress(line)
            if progress is not None:
                await on_progress(*progress)
            elif line:
                final_path = line
        code = await process.wait()
    except BaseException:
        with contextlib.suppress(ProcessLookupError):
            process.kill()
        await process.wait()
        stderr_task.cancel()
        raise
    stderr = (await stderr_task).decode("utf-8", "replace")
    if code != 0:
        raise _error_from_stderr(stderr)

    resolved_dir = output_dir.resolve()
    candidates = [Path(final_path)] if final_path else []
    candidates += sorted(output_dir.glob("media.*"))
    for candidate in candidates:
        resolved = candidate.resolve()
        if (
            resolved.is_relative_to(resolved_dir)
            and resolved.is_file()
            and resolved.stat().st_size > 0
        ):
            size = resolved.stat().st_size
            if size > max_bytes:
                raise AppError(ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit")
            return MediaResult(path=resolved, size=size, ext=resolved.suffix.lower())
    raise AppError(ErrorCode.MEDIA_PROCESSING_FAILED, "yt-dlp finished without an output file")
