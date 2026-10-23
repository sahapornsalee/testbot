"""Content type detection, categorisation and safe file naming."""

from __future__ import annotations

import mimetypes
import posixpath
import re
import unicodedata
from email.message import Message
from typing import Literal
from urllib.parse import unquote, urlsplit

Category = Literal["image", "video", "audio", "document", "archive", "other"]

# (offset, signature, mime). Checked against the first bytes of the body so that the
# file extension or the server's Content-Type is never the only evidence.
MAGIC_SIGNATURES: tuple[tuple[int, bytes, str], ...] = (
    (0, b"\xff\xd8\xff", "image/jpeg"),
    (0, b"\x89PNG\r\n\x1a\n", "image/png"),
    (0, b"GIF87a", "image/gif"),
    (0, b"GIF89a", "image/gif"),
    (0, b"BM", "image/bmp"),
    (0, b"%PDF-", "application/pdf"),
    (0, b"PK\x03\x04", "application/zip"),
    (0, b"PK\x05\x06", "application/zip"),
    (0, b"\x1f\x8b", "application/gzip"),
    (0, b"7z\xbc\xaf\x27\x1c", "application/x-7z-compressed"),
    (0, b"Rar!\x1a\x07", "application/vnd.rar"),
    (0, b"ID3", "audio/mpeg"),
    (0, b"\xff\xfb", "audio/mpeg"),
    (0, b"\xff\xf3", "audio/mpeg"),
    (0, b"fLaC", "audio/flac"),
    (0, b"OggS", "audio/ogg"),
    (0, b"\x1a\x45\xdf\xa3", "video/webm"),
    (0, b"MZ", "application/x-msdownload"),
    (0, b"\x7fELF", "application/x-executable"),
)

RISKY_EXTENSIONS = frozenset(
    {
        ".exe",
        ".dll",
        ".bat",
        ".cmd",
        ".com",
        ".scr",
        ".msi",
        ".ps1",
        ".vbs",
        ".js",
        ".jse",
        ".wsf",
        ".hta",
        ".lnk",
        ".sh",
        ".jar",
        ".apk",
        ".app",
        ".reg",
        ".cpl",
    }
)
WINDOWS_RESERVED = frozenset(
    {"con", "prn", "aux", "nul"}
    | {f"com{i}" for i in range(1, 10)}
    | {f"lpt{i}" for i in range(1, 10)}
)
MAX_FILENAME_LENGTH = 150

_ARCHIVE_MIMES = {
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-7z-compressed",
    "application/vnd.rar",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/x-bzip2",
    "application/x-xz",
}
_DOCUMENT_MIMES = {
    "application/pdf",
    "application/json",
    "application/xml",
    "application/msword",
    "application/rtf",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/epub+zip",
}


def sniff_mime(head: bytes) -> str | None:
    for offset, signature, mime in MAGIC_SIGNATURES:
        if head[offset : offset + len(signature)] == signature:
            return mime
    if len(head) >= 12 and head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"M4A ", b"M4B "):
            return "audio/mp4"
        if brand in (b"qt  ",):
            return "video/quicktime"
        if brand in (b"avif", b"avis"):
            return "image/avif"
        if brand in (b"heic", b"heix", b"mif1"):
            return "image/heic"
        return "video/mp4"
    if head[:4] == b"RIFF" and len(head) >= 12:
        kind = head[8:12]
        if kind == b"WEBP":
            return "image/webp"
        if kind == b"WAVE":
            return "audio/wav"
        if kind == b"AVI ":
            return "video/x-msvideo"
    stripped = head.lstrip()[:64].lower()
    if stripped.startswith((b"<!doctype html", b"<html")):
        return "text/html"
    if stripped.startswith(b"<?xml") or stripped.startswith(b"<svg"):
        return "image/svg+xml" if b"<svg" in head[:512].lower() else "application/xml"
    if stripped.startswith((b"{", b"[")):
        return None  # could be JSON; let the declared type decide
    return None


def normalize_mime(value: str | None) -> str | None:
    if not value:
        return None
    mime = value.split(";", 1)[0].strip().lower()
    return mime or None


def resolve_mime(declared: str | None, sniffed: str | None, filename: str | None) -> str:
    """Pick the most trustworthy content type.

    Order: magic bytes > declared Content-Type > extension. A generic declared type
    (``application/octet-stream``) never overrides a sniffed type.
    """
    declared = normalize_mime(declared)
    if sniffed:
        return sniffed
    if declared and declared not in ("application/octet-stream", "binary/octet-stream"):
        return declared
    if filename:
        guessed, _ = mimetypes.guess_type(filename)
        if guessed:
            return guessed
    return declared or "application/octet-stream"


def categorize(mime: str) -> Category:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if mime in _ARCHIVE_MIMES:
        return "archive"
    if mime.startswith("text/") or mime in _DOCUMENT_MIMES or "officedocument" in mime:
        return "document"
    return "other"


def extension_for(mime: str) -> str | None:
    overrides = {
        "image/jpeg": ".jpg",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "video/mp4": ".mp4",
        "text/plain": ".txt",
        "application/gzip": ".gz",
        "image/webp": ".webp",
        "video/webm": ".webm",
        "audio/wav": ".wav",
    }
    return overrides.get(mime) or mimetypes.guess_extension(mime)


def filename_from_content_disposition(header: str | None) -> str | None:
    if not header:
        return None
    msg = Message()
    msg["content-disposition"] = header
    name = msg.get_filename()
    return name or None


def filename_from_url(url: str) -> str | None:
    path = urlsplit(url).path
    name = posixpath.basename(unquote(path))
    return name or None


def sanitize_filename(
    name: str | None, fallback_stem: str = "download", mime: str | None = None
) -> str:
    """Return a filename that is safe on Windows, macOS and Linux.

    Removes directory components, control and reserved characters, Windows device
    names, leading dots and trailing dots/spaces. Never returns an empty name.
    """
    candidate = unicodedata.normalize("NFC", name or "")
    candidate = candidate.replace("\\", "/").split("/")[-1]
    candidate = re.sub(r"[\x00-\x1f\x7f<>:\"|?*]", "_", candidate)
    candidate = re.sub(r"\s+", " ", candidate).strip().strip(".").strip()
    if candidate in ("", ".", ".."):
        candidate = fallback_stem

    stem, dot, ext = candidate.rpartition(".")
    if not dot:
        stem, ext = candidate, ""
    if stem.lower() in WINDOWS_RESERVED or candidate.lower() in WINDOWS_RESERVED:
        stem = f"_{stem or candidate}"
    ext = f".{ext.lower()}" if ext else ""
    if not ext and mime:
        ext = extension_for(mime) or ""
    if len(ext) > 16:
        ext = ""

    max_stem = MAX_FILENAME_LENGTH - len(ext)
    stem = (stem or fallback_stem)[:max_stem].rstrip(" .") or fallback_stem
    return f"{stem}{ext}"


def is_risky_filename(name: str) -> bool:
    return posixpath.splitext(name.lower())[1] in RISKY_EXTENSIONS
