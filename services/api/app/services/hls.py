"""HLS (.m3u8) stream downloads.

The playlist, every segment and every key are fetched through the SSRF-guarded client.
Segments are downloaded in parallel into per-segment files (so a paused job resumes by
skipping finished segments), concatenated, and remuxed to MP4 with a local-only FFmpeg
call when FFmpeg is available.

Supported: VOD playlists, master playlists (variant selection from the real variants),
fMP4 (#EXT-X-MAP) and clear-key AES-128. Refused: live playlists (no #EXT-X-ENDLIST),
byte-range playlists, and DRM (SAMPLE-AES, or any KEYFORMAT other than "identity").
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import re
import shutil
import subprocess  # noqa: S404 - argument lists only
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from app.core.errors import AppError, ErrorCode
from app.core.url_policy import validate_url
from app.schemas.models import MediaFormat, MediaInfo
from app.services.safe_http import map_transport_error, open_stream

PLAYLIST_TYPES = frozenset(
    {"application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl", "audio/x-mpegurl"}
)
MAX_PLAYLIST_BYTES = 2 * 1024 * 1024
MAX_SEGMENTS = 20_000
SEGMENT_ATTEMPTS = 3
_ATTR = re.compile(r'([A-Z0-9-]+)=("[^"]*"|[^,]*)')


@dataclass
class Variant:
    url: str
    bandwidth: int | None = None
    width: int | None = None
    height: int | None = None
    codecs: str | None = None
    fps: float | None = None


@dataclass
class Key:
    method: str
    uri: str | None = None
    iv: bytes | None = None


@dataclass
class HlsSegment:
    url: str
    sequence: int
    key: Key | None = None


@dataclass
class MediaPlaylist:
    segments: list[HlsSegment] = field(default_factory=list)
    init_url: str | None = None
    init_key: Key | None = None
    duration: float = 0.0


def is_playlist(url: str, content_type: str | None) -> bool:
    if content_type and content_type.split(";")[0].strip().lower() in PLAYLIST_TYPES:
        return True
    return urlsplit(url).path.lower().endswith(".m3u8")


def _attrs(text: str) -> dict[str, str]:
    return {key: value.strip('"') for key, value in _ATTR.findall(text)}


def _resolve(base: str, ref: str) -> str:
    try:
        return validate_url(urljoin(base, ref.strip())).url
    except AppError as exc:
        raise AppError(
            ErrorCode.BLOCKED_DESTINATION, "The playlist references an invalid URL"
        ) from exc


def parse_playlist(text: str, base_url: str) -> list[Variant] | MediaPlaylist:
    """Parse an M3U8 document into master variants or a media playlist."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines or not lines[0].startswith("#EXTM3U"):
        raise AppError(ErrorCode.UNSUPPORTED_CONTENT, "This is not an HLS playlist")

    if any(line.startswith("#EXT-X-STREAM-INF") for line in lines):
        variants: list[Variant] = []
        pending: dict[str, str] | None = None
        for line in lines:
            if line.startswith("#EXT-X-STREAM-INF:"):
                pending = _attrs(line.split(":", 1)[1])
            elif not line.startswith("#") and pending is not None:
                width = height = None
                if "x" in pending.get("RESOLUTION", ""):
                    w, _, h = pending["RESOLUTION"].partition("x")
                    if w.isdigit() and h.isdigit():
                        width, height = int(w), int(h)
                bandwidth = pending.get("AVERAGE-BANDWIDTH") or pending.get("BANDWIDTH")
                fps = pending.get("FRAME-RATE")
                variants.append(
                    Variant(
                        url=_resolve(base_url, line),
                        bandwidth=int(bandwidth) if bandwidth and bandwidth.isdigit() else None,
                        width=width,
                        height=height,
                        codecs=pending.get("CODECS"),
                        fps=float(fps) if fps and fps.replace(".", "", 1).isdigit() else None,
                    )
                )
                pending = None
        if not variants:
            raise AppError(ErrorCode.UNSUPPORTED_CONTENT, "The playlist has no streams")
        return variants

    playlist = MediaPlaylist()
    key: Key | None = None
    sequence = 0
    ended = False
    for line in lines:
        if line.startswith("#EXT-X-MEDIA-SEQUENCE:"):
            value = line.split(":", 1)[1]
            sequence = int(value) if value.isdigit() else 0
        elif line.startswith("#EXT-X-KEY:"):
            attrs = _attrs(line.split(":", 1)[1])
            method = attrs.get("METHOD", "NONE").upper()
            keyformat = attrs.get("KEYFORMAT", "identity")
            if method == "NONE":
                key = None
            elif method != "AES-128" or keyformat != "identity":
                raise AppError(
                    ErrorCode.UNSUPPORTED_SOURCE, "This stream is DRM protected and cannot be saved"
                )
            else:
                iv_hex = attrs.get("IV", "")
                iv = (
                    bytes.fromhex(iv_hex[2:].rjust(32, "0"))
                    if iv_hex.lower().startswith("0x")
                    else None
                )
                if "URI" not in attrs:
                    raise AppError(
                        ErrorCode.UNSUPPORTED_CONTENT, "Encrypted stream without key URI"
                    )
                key = Key("AES-128", _resolve(base_url, attrs["URI"]), iv)
        elif line.startswith("#EXT-X-MAP:"):
            attrs = _attrs(line.split(":", 1)[1])
            if "BYTERANGE" in attrs:
                raise AppError(ErrorCode.UNSUPPORTED_CONTENT, "Byte-range HLS is not supported yet")
            playlist.init_url = _resolve(base_url, attrs.get("URI", ""))
            playlist.init_key = key
        elif line.startswith("#EXT-X-BYTERANGE"):
            raise AppError(ErrorCode.UNSUPPORTED_CONTENT, "Byte-range HLS is not supported yet")
        elif line.startswith("#EXTINF:"):
            value = line.split(":", 1)[1].split(",", 1)[0]
            with contextlib.suppress(ValueError):
                playlist.duration += float(value)
        elif line.startswith("#EXT-X-ENDLIST"):
            ended = True
        elif not line.startswith("#"):
            playlist.segments.append(HlsSegment(_resolve(base_url, line), sequence, key))
            sequence += 1
    if not ended:
        raise AppError(
            ErrorCode.UNSUPPORTED_SOURCE, "Live streams cannot be saved, only finished videos"
        )
    if not playlist.segments:
        raise AppError(ErrorCode.UNSUPPORTED_CONTENT, "The playlist has no segments")
    if len(playlist.segments) > MAX_SEGMENTS:
        raise AppError(ErrorCode.FILE_TOO_LARGE, "The stream has too many segments")
    return playlist


def _kind(variant: Variant) -> str:
    codecs = (variant.codecs or "").lower()
    has_video = variant.height is not None or any(
        c in codecs for c in ("avc", "hvc", "hev", "vp", "av01")
    )
    if (
        not has_video
        and codecs
        and all(c.strip().startswith(("mp4a", "ac-3", "ec-3", "opus")) for c in codecs.split(","))
    ):
        return "audio"
    return "video+audio"


def variants_to_media(variants: list[Variant] | None, title: str, ffmpeg: bool) -> MediaInfo:
    """Expose the real variants as selectable formats (``v0``, ``v1``...)."""
    formats = [
        MediaFormat(
            format_id=f"v{index}",
            ext="mp4",
            kind=_kind(variant),  # type: ignore[arg-type]
            width=variant.width,
            height=variant.height,
            fps=variant.fps,
            tbr=round(variant.bandwidth / 1000, 1) if variant.bandwidth else None,
            note="HLS",
        )
        for index, variant in enumerate(variants or [Variant(url="")])
    ]
    best = max(formats, key=lambda f: (f.height or 0, f.tbr or 0)) if formats else None
    return MediaInfo(
        title=title,
        extractor="HLS",
        formats=formats,
        best_format_id=best.format_id if best else None,
        ffmpeg_available=ffmpeg,
    )


async def fetch_text(client: httpx.AsyncClient, url: str, max_redirects: int) -> tuple[str, str]:
    async with open_stream(client, url, max_redirects=max_redirects) as result:
        if result.response.status_code >= 400:
            raise AppError(
                ErrorCode.SOURCE_UNAVAILABLE,
                f"The source answered HTTP {result.response.status_code}",
            )
        body = bytearray()
        async for chunk in result.response.aiter_bytes():
            body += chunk
            if len(body) > MAX_PLAYLIST_BYTES:
                raise AppError(ErrorCode.FILE_TOO_LARGE, "The playlist is too large")
        return body.decode("utf-8", errors="replace"), result.final_url


def stream_title(url: str) -> str:
    path = urlsplit(url).path
    stem = Path(path).stem
    generic = {
        "index",
        "master",
        "playlist",
        "prog_index",
        "chunklist",
        "manifest",
        "video",
        "stream",
    }
    if not stem or stem.lower() in generic:
        parent = Path(path).parent.name
        stem = (
            parent
            if parent and parent.lower() not in generic
            else urlsplit(url).hostname or "stream"
        )
    return stem


async def inspect_stream(
    client: httpx.AsyncClient, url: str, max_redirects: int, ffmpeg: bool
) -> MediaInfo:
    text, final_url = await fetch_text(client, url, max_redirects)
    parsed = parse_playlist(text, final_url)
    if isinstance(parsed, list):
        return variants_to_media(parsed, stream_title(final_url), ffmpeg)
    info = variants_to_media(None, stream_title(final_url), ffmpeg)
    info.duration_seconds = round(parsed.duration, 1) or None
    return info


def _decrypt(data: bytes, key: bytes, iv: bytes) -> bytes:
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    plain = decryptor.update(data) + decryptor.finalize()
    pad = plain[-1] if plain else 0
    if 1 <= pad <= 16 and plain.endswith(bytes([pad]) * pad):
        plain = plain[:-pad]
    return plain


@dataclass
class HlsResult:
    path: Path
    size: int
    ext: str
    title: str
    connections: int


ProgressCallback = Callable[[int, int | None], Awaitable[None]]


async def download_hls(
    client: httpx.AsyncClient,
    url: str,
    work_dir: Path,
    *,
    format_id: str,
    max_bytes: int,
    max_redirects: int,
    connections: int,
    ffmpeg: str | None,
    on_progress: ProgressCallback,
    on_plan: Callable[[int], None] | None = None,
) -> HlsResult:
    text, final_url = await fetch_text(client, url, max_redirects)
    parsed = parse_playlist(text, final_url)
    title = stream_title(final_url)
    if isinstance(parsed, list):
        if format_id == "best":
            index = max(
                range(len(parsed)), key=lambda i: (parsed[i].height or 0, parsed[i].bandwidth or 0)
            )
        else:
            if not re.fullmatch(r"v\d{1,4}", format_id) or int(format_id[1:]) >= len(parsed):
                raise AppError(
                    ErrorCode.FORMAT_NOT_AVAILABLE, "The selected quality is not available"
                )
            index = int(format_id[1:])
        text, media_url = await fetch_text(client, parsed[index].url, max_redirects)
        playlist = parse_playlist(text, media_url)
        if isinstance(playlist, list):
            raise AppError(
                ErrorCode.UNSUPPORTED_CONTENT, "Nested master playlists are not supported"
            )
    else:
        if format_id not in ("best", "v0"):
            raise AppError(ErrorCode.FORMAT_NOT_AVAILABLE, "The selected quality is not available")
        playlist = parsed

    work_dir.mkdir(parents=True, exist_ok=True)
    keys: dict[str, bytes] = {}
    key_lock = asyncio.Lock()

    async def key_bytes(key: Key) -> bytes:
        assert key.uri is not None
        async with key_lock:
            if key.uri not in keys:
                async with open_stream(client, key.uri, max_redirects=max_redirects) as result:
                    data = b""
                    async for chunk in result.response.aiter_bytes():
                        data += chunk
                        if len(data) > 64:
                            break
                if result.response.status_code != 200 or len(data) != 16:
                    raise AppError(ErrorCode.UNSUPPORTED_SOURCE, "The stream key could not be read")
                keys[key.uri] = data
            return keys[key.uri]

    items: list[tuple[str, str, Key | None, int]] = []
    if playlist.init_url:
        items.append(("init", playlist.init_url, playlist.init_key, 0))
    items += [
        (f"{i:05d}", seg.url, seg.key, seg.sequence) for i, seg in enumerate(playlist.segments)
    ]
    if on_plan is not None:
        on_plan(min(connections, len(items)))

    done_sizes = {
        name: (work_dir / f"seg_{name}").stat().st_size
        for name, *_ in items
        if (work_dir / f"seg_{name}").exists()
    }
    total = sum(done_sizes.values())

    def estimate() -> int | None:
        if not done_sizes:
            return None
        return int(total / len(done_sizes) * len(items))

    await on_progress(total, estimate())
    limiter = asyncio.Semaphore(max(1, connections))

    async def fetch(name: str, seg_url: str, key: Key | None, sequence: int) -> None:
        nonlocal total
        target = work_dir / f"seg_{name}"
        if target.exists():
            return
        async with limiter:
            for attempt in range(1, SEGMENT_ATTEMPTS + 1):
                try:
                    async with open_stream(client, seg_url, max_redirects=max_redirects) as result:
                        if result.response.status_code != 200:
                            raise AppError(
                                ErrorCode.SOURCE_UNAVAILABLE,
                                f"A stream segment answered HTTP {result.response.status_code}",
                            )
                        data = bytearray()
                        async for chunk in result.response.aiter_bytes():
                            data += chunk
                            if total + len(data) > max_bytes:
                                raise AppError(
                                    ErrorCode.FILE_TOO_LARGE, "The file exceeds the size limit"
                                )
                    break
                except AppError:
                    raise
                except httpx.HTTPError as exc:
                    if attempt == SEGMENT_ATTEMPTS:
                        raise map_transport_error(exc) from exc
                    await asyncio.sleep(0.25 * attempt)
            payload = bytes(data)
            if key is not None:
                iv = key.iv or sequence.to_bytes(16, "big")
                payload = _decrypt(payload, await key_bytes(key), iv)
            partial = target.with_suffix(".tmp")
            partial.write_bytes(payload)
            os.replace(partial, target)  # a finished segment is never half-written
            done_sizes[name] = len(payload)
            total += len(payload)
            await on_progress(total, estimate())

    try:
        async with asyncio.TaskGroup() as group:
            for item in items:
                group.create_task(fetch(*item))
    except BaseExceptionGroup as group_error:
        for exc in group_error.exceptions:
            if not isinstance(exc, asyncio.CancelledError):
                raise exc from None
        raise

    fmp4 = playlist.init_url is not None
    joined = work_dir / ("joined.mp4" if fmp4 else "joined.ts")
    with joined.open("wb") as out:
        for name, *_ in items:
            with (work_dir / f"seg_{name}").open("rb") as part:
                shutil.copyfileobj(part, out)

    output = joined
    if ffmpeg and not fmp4:
        remuxed = work_dir / "output.mp4"
        if await asyncio.to_thread(_remux, ffmpeg, joined, remuxed):
            output = remuxed
    size = output.stat().st_size
    if size == 0:
        raise AppError(ErrorCode.INCOMPLETE_DOWNLOAD, "The stream was empty")
    return HlsResult(output, size, output.suffix, title, min(connections, len(items)))


def _remux(ffmpeg: str, source: Path, target: Path) -> bool:
    """Copy streams into MP4 without re-encoding. Local files only: no network protocols."""
    args = [
        ffmpeg,
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-protocol_whitelist",
        "file",
        "-i",
        str(source),
        "-map",
        "0",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(target),
    ]
    try:
        completed = subprocess.run(args, capture_output=True, timeout=600, check=False)  # noqa: S603
    except (OSError, subprocess.TimeoutExpired):
        return False
    return completed.returncode == 0 and target.exists() and target.stat().st_size > 0
