"""Find downloadable resources on a web page ("grab all links", like IDM's site grabber).

Only the page itself is fetched (through the SSRF-guarded client, capped at
``max_page_bytes``). Found links are not requested here; each one is validated again
when the user downloads it.
"""

from __future__ import annotations

import posixpath
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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {key: value for key, value in attrs if value}
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
            if "src" in a:
                self.found.append((a["src"], tag, label, hint))
            if tag == "video" and "poster" in a:
                self.found.append((a["poster"], "video", label, "image"))
            for candidate in (a.get("srcset") or "").split(","):
                part = candidate.strip().split(" ")[0]
                if part:
                    self.found.append((part, tag, label, hint))
        elif tag == "source":
            hint = self._media_parent or "video"
            if "src" in a:
                self.found.append((a["src"], "source", None, hint))
            for candidate in (a.get("srcset") or "").split(","):
                part = candidate.strip().split(" ")[0]
                if part:
                    self.found.append((part, "source", None, "image"))
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
        if tag == "a" and self._anchor is not None:
            text = " ".join("".join(self._anchor).split())
            url, src, label, hint = self.found[self._anchor_index]
            if not label and text:
                self.found[self._anchor_index] = (url, src, text, hint)
            self._anchor = None
        elif tag in ("video", "audio"):
            self._media_parent = None

    def handle_data(self, data: str) -> None:
        if self._anchor is not None and sum(map(len, self._anchor)) < MAX_LABEL:
            self._anchor.append(data)


def extract_links(html: str, page_url: str) -> list[PageLink]:
    """Return de-duplicated downloadable links found in ``html``.

    Anchors count only when their path has a known file extension; media elements count
    regardless. URLs that fail validation (javascript:, data:, credentials, ...) are dropped.
    """
    parser = _LinkParser()
    parser.feed(html)
    parser.close()
    base = urljoin(page_url, parser.base) if parser.base else page_url

    links: list[PageLink] = []
    seen: set[str] = set()
    for raw, tag, label, hint in parser.found:
        try:
            url = validate_url(urljoin(base, raw.strip())).url
        except (AppError, ValueError):
            continue
        if url in seen or url.rstrip("/") == page_url.rstrip("/"):
            continue
        ext = _extension(url)
        category = _EXTENSIONS.get(ext or "")
        if category is None:
            if tag in ("a", "iframe", "embed") or hint is None:
                continue  # an ordinary page link, not a file
            category = hint if hint in ("image", "video", "audio") else "other"
        seen.add(url)
        clean_label = " ".join(label.split())[:MAX_LABEL] if label else None
        links.append(
            PageLink(url=url, category=category, extension=ext, source=tag, label=clean_label)
        )
        if len(links) >= MAX_LINKS:
            break
    return links


async def fetch_page_links(
    client: httpx.AsyncClient, url: str, *, max_redirects: int, max_bytes: int
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
        return extract_links(html, result.final_url)
