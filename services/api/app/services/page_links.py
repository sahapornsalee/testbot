"""Find downloadable resources on a web page ("grab all links", like IDM's site grabber).

Only the page itself is fetched (through the SSRF-guarded client, capped at
``max_page_bytes``). Found links are not requested here; each one is validated again
when the user downloads it.
"""

from __future__ import annotations

import asyncio
import json
import posixpath
import re
from collections.abc import Callable
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlsplit

import httpx

from app.core.errors import AppError, ErrorCode
from app.core.url_policy import validate_url
from app.schemas.models import PageLink
from app.services.safe_http import open_stream

MAX_LINKS = 500
MAX_LABEL = 120

_EXTENSIONS: dict[str, str] = {}
for _category, _exts in {
    "image": "jpg jpeg png gif webp bmp tif tiff svg avif heic ico",
    "video": "mp4 m4v webm mkv mov avi wmv flv mpg mpeg 3gp ts",
    "audio": "mp3 m4a aac wav flac ogg oga opus wma",
    "document": "pdf doc docx xls xlsx ppt pptx odt ods odp rtf txt csv json xml epub",
    "archive": "zip rar 7z tar gz tgz bz2 xz",
    "other": "exe msi dmg pkg deb rpm apk iso img bin torrent",
    "stream": "m3u8 mpd",
}.items():
    for _ext in _exts.split():
        _EXTENSIONS[_ext] = _category

# Elements whose URL is a resource by nature (the extension is not required).
_MEDIA_TAGS = {"img": "image", "video": "video", "audio": "audio"}
_LAZY_SRC = ("src", "data-src", "data-lazy-src", "data-original", "data-url", "data-full")
_LAZY_SRCSET = ("srcset", "data-srcset", "data-lazy-srcset")
_LINK_RELS = {
    "icon": "image",
    "shortcut icon": "image",
    "apple-touch-icon": "image",
    "image_src": "image",
    "enclosure": None,
    "preload": None,
}
_CSS_URL = re.compile(r"""url\(\s*['"]?([^'")\s]+)['"]?\s*\)""", re.IGNORECASE)
# Absolute media URLs inside inline scripts/JSON (video player configs), like IDM's sniffing.
_SCRIPT_MEDIA = re.compile(
    r"""https?://[^\s"'<>\\]+?\.(?:m3u8|mp4|m4v|webm|mov|mp3|m4a|aac|ogg|flac|wav|mpd)"""
    r"""(?:\?[^\s"'<>\\]*)?""",
    re.IGNORECASE,
)
_LD_KEYS = ("contentUrl", "embedUrl", "thumbnailUrl", "url")
MAX_MEDIA_CHECKS = 200


def _extension(url: str) -> str | None:
    name = posixpath.basename(unquote(urlsplit(url).path))
    _, dot, ext = name.rpartition(".")
    return ext.lower() if dot and ext and len(ext) <= 8 else None


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base: str | None = None
        self.found: list[tuple[str, str, str | None, str | None]] = []  # url, tag, label, hint
        self._anchor: list[str] | None = None
        self._anchor_index = -1
        self._media_parent: str | None = None
        self._text_tag: str | None = None  # "style" or "script" while inside one
        self._script_type = ""
        self.script_text: list[str] = []
        self.jsonld: list[str] = []

    def _srcset(self, value: str | None, tag: str, label: str | None, hint: str | None) -> None:
        for candidate in (value or "").split(","):
            part = candidate.strip().split(" ")[0]
            if part:
                self.found.append((part, tag, label, hint))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {key: value for key, value in attrs if value}
        for match in _CSS_URL.findall(a.get("style", "")):
            self.found.append((match, "style", None, None))  # kept only with a file extension
        if tag in ("style", "script"):
            self._text_tag = tag
            self._script_type = (a.get("type") or "").lower()
            return
        if tag == "base" and "href" in a and self.base is None:
            self.base = a["href"]
        elif tag == "a" and "href" in a:
            self.found.append((a["href"], "a", a.get("title") or a.get("download"), None))
            self._anchor = []
            self._anchor_index = len(self.found) - 1
        elif tag in _MEDIA_TAGS:
            hint = _MEDIA_TAGS[tag]
            self._media_parent = hint if tag != "img" else self._media_parent
            label = a.get("alt") or a.get("title")
            for attr in _LAZY_SRC:
                if attr in a:
                    self.found.append((a[attr], tag, label, hint))
            if tag == "video" and "poster" in a:
                self.found.append((a["poster"], "video", label, "image"))
            for attr in _LAZY_SRCSET:
                self._srcset(a.get(attr), tag, label, hint)
        elif tag == "source":
            hint = self._media_parent or "video"
            for attr in _LAZY_SRC:
                if attr in a:
                    self.found.append((a[attr], "source", None, hint))
            for attr in _LAZY_SRCSET:
                self._srcset(a.get(attr), "source", None, "image")
        elif tag == "link" and "href" in a:
            rel = (a.get("rel") or "").lower()
            if rel in _LINK_RELS:
                as_type = (a.get("as") or "").lower()
                hint = _LINK_RELS[rel] or (
                    as_type if as_type in ("image", "video", "audio") else None
                )
                self.found.append((a["href"], "link", a.get("title"), hint))
        elif tag in ("embed", "iframe") and "src" in a:
            self.found.append((a["src"], tag, a.get("title"), None))
        elif tag == "object" and "data" in a:
            self.found.append((a["data"], tag, None, None))
        elif tag == "meta" and "content" in a:
            prop = (a.get("property") or a.get("name") or "").lower()
            if prop in ("og:video", "og:video:url", "og:video:secure_url", "og:audio"):
                self.found.append((a["content"], "meta", None, prop.split(":")[1]))
            elif prop in ("og:image", "og:image:url", "twitter:image"):
                self.found.append((a["content"], "meta", None, "image"))

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script"):
            self._text_tag = None
            return
        if tag == "a" and self._anchor is not None:
            text = " ".join("".join(self._anchor).split())
            url, src, label, hint = self.found[self._anchor_index]
            if not label and text:
                self.found[self._anchor_index] = (url, src, text, hint)
            self._anchor = None
        elif tag in ("video", "audio"):
            self._media_parent = None

    def handle_data(self, data: str) -> None:
        if self._text_tag == "style":
            for match in _CSS_URL.findall(data):
                self.found.append((match, "style", None, None))
            return
        if self._text_tag == "script":
            if "ld+json" in self._script_type:
                self.jsonld.append(data)
            self.script_text.append(data)
            return
        if self._anchor is not None and sum(map(len, self._anchor)) < MAX_LABEL:
            self._anchor.append(data)


def _jsonld_urls(blocks: list[str]) -> list[str]:
    urls: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in _LD_KEYS and isinstance(value, str):
                    urls.append(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    for block in blocks:
        try:
            walk(json.loads(block))
        except ValueError:
            continue
    return urls


def extract_links(
    html: str,
    page_url: str,
    media_detector: Callable[[str], str | None] | None = None,
) -> list[PageLink]:
    """Return de-duplicated downloadable things found in ``html``.

    Files come first (known extension, media elements, lazy-loaded images, CSS images,
    media URLs inside scripts and JSON-LD), then pages a site-specific yt-dlp extractor
    understands (``media``), then remaining ordinary links (``link``). URLs that fail
    validation (javascript:, data:, credentials, ...) are dropped.
    """
    parser = _LinkParser()
    parser.feed(html)
    parser.close()
    base = urljoin(page_url, parser.base) if parser.base else page_url

    candidates = list(parser.found)
    for url in _jsonld_urls(parser.jsonld):
        candidates.append((url, "json-ld", None, None))
    script = "\n".join(parser.script_text).replace("\\/", "/")
    for match in _SCRIPT_MEDIA.findall(script):
        candidates.append((match, "script", None, None))

    files: list[PageLink] = []
    pages: list[tuple[str, str, str | None]] = []
    seen: set[str] = set()
    page_key = page_url.rstrip("/")
    for raw, tag, label, hint in candidates:
        try:
            url = validate_url(urljoin(base, raw.strip())).url
        except (AppError, ValueError):
            continue
        if url in seen or url.rstrip("/") == page_key:
            continue
        seen.add(url)
        clean_label = " ".join(label.split())[:MAX_LABEL] if label else None
        ext = _extension(url)
        category = _EXTENSIONS.get(ext or "")
        if category is None and hint in ("image", "video", "audio"):
            category = hint
        if category is not None:
            files.append(
                PageLink(url=url, category=category, extension=ext, source=tag, label=clean_label)
            )
        elif tag in ("a", "iframe", "embed", "json-ld", "meta"):
            pages.append((url, tag, clean_label))

    media_links: list[PageLink] = []
    other_links: list[PageLink] = []
    for index, (url, tag, label) in enumerate(pages):
        extractor = (
            media_detector(url) if media_detector is not None and index < MAX_MEDIA_CHECKS else None
        )
        if extractor:
            media_links.append(
                PageLink(
                    url=url, category="media", extension=None, source=tag, label=label or extractor
                )
            )
        elif tag == "a":
            other_links.append(
                PageLink(url=url, category="link", extension=None, source=tag, label=label)
            )
    return (files + media_links + other_links)[:MAX_LINKS]


async def fetch_page_links(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_redirects: int,
    max_bytes: int,
    media_detector: Callable[[str], str | None] | None = None,
) -> list[PageLink]:
    async with open_stream(client, url, max_redirects=max_redirects) as result:
        response = result.response
        if response.status_code >= 400:
            raise AppError(
                ErrorCode.SOURCE_UNAVAILABLE, f"The source answered HTTP {response.status_code}"
            )
        body = bytearray()
        try:
            async for chunk in response.aiter_bytes():
                body += chunk
                if len(body) >= max_bytes:
                    break  # parse what we have; very large pages are truncated
        except httpx.HTTPError:
            if not body:
                raise
        encoding = response.charset_encoding or "utf-8"
        try:
            html = bytes(body[:max_bytes]).decode(encoding, errors="replace")
        except LookupError:
            html = bytes(body[:max_bytes]).decode("utf-8", errors="replace")
        final_url = result.final_url
    # yt-dlp extractor matching is CPU-bound; keep it off the event loop.
    return await asyncio.to_thread(extract_links, html, final_url, media_detector)
