"""URL analyzer: decides between media (yt-dlp) and direct-file inspection."""

from __future__ import annotations

from pathlib import Path

import httpx

from app.core.config import Settings
from app.core.url_policy import DestinationPolicy
from app.schemas.models import InspectResponse
from app.services import file_types, media
from app.services.direct import inspect_http


async def inspect_url(
    raw_url: str,
    *,
    settings: Settings,
    policy: DestinationPolicy,
    client: httpx.AsyncClient,
) -> InspectResponse:
    validated = await policy.validate(raw_url)
    url = validated.url

    extractor = media.dedicated_extractor(url) if settings.ytdlp_enabled else None
    if extractor:
        ffmpeg = media.ffmpeg_path(settings.ffmpeg_location)
        info = await media.inspect_media(url, settings.media_inspect_timeout_seconds, ffmpeg)
        warnings: list[str] = []
        if not info.formats:
            warnings.append("NO_FORMATS")
        if not info.ffmpeg_available:
            warnings.append("FFMPEG_MISSING")
        title = info.title or "media"
        return InspectResponse(
            url=url,
            final_url=url,
            redirect_chain=[],
            kind="media",
            status_code=200,
            content_type="video/*",
            declared_content_type=None,
            category="video" if any(f.kind != "audio" for f in info.formats) else "audio",
            size_bytes=None,
            filename=file_types.sanitize_filename(title, fallback_stem="media"),
            extension=None,
            accepts_ranges=False,
            downloadable=bool(info.formats),
            warnings=warnings,
            media=info,
        )

    result = await inspect_http(client, url, settings.max_redirects)
    warnings = []
    downloadable = True
    kind = "file"
    if result.content_type == "text/html":
        kind = "webpage"
        downloadable = False
        warnings.append("WEBPAGE_NOT_FILE")
    if result.size_bytes is None:
        warnings.append("SIZE_UNKNOWN")
    elif result.size_bytes > settings.max_file_size_bytes:
        downloadable = False
        warnings.append("FILE_TOO_LARGE")
    if file_types.is_risky_filename(result.filename) or result.content_type in (
        "application/x-msdownload",
        "application/x-executable",
    ):
        warnings.append("RISKY_FILE_TYPE")

    return InspectResponse(
        url=url,
        final_url=result.final_url,
        redirect_chain=result.redirect_chain,
        kind=kind,  # type: ignore[arg-type]
        status_code=result.status_code,
        content_type=result.content_type,
        declared_content_type=result.declared_content_type,
        category=result.category,
        size_bytes=result.size_bytes,
        filename=result.filename,
        extension=Path(result.filename).suffix.lower() or None,
        accepts_ranges=result.accepts_ranges,
        downloadable=downloadable,
        warnings=warnings,
    )
