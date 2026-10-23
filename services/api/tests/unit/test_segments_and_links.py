from pathlib import Path

import pytest

from app.services.direct import DownloadState, Segment, plan_segments
from app.services.page_links import extract_links
from tests.conftest import GALLERY_HTML


@pytest.mark.parametrize(
    ("size", "connections", "min_segment", "expected_count"),
    [
        (1000, 8, 100, 8),
        (1000, 8, 400, 2),
        (1000, 8, 2000, 1),
        (10, 4, 1, 4),
        (1, 8, 1, 1),
    ],
)
def test_plan_segments_covers_file_exactly(size, connections, min_segment, expected_count) -> None:
    segments = plan_segments(size, connections, min_segment)
    assert len(segments) == expected_count
    assert segments[0].start == 0 and segments[-1].end == size - 1
    for left, right in zip(segments, segments[1:], strict=False):
        assert right.start == left.end + 1
    assert sum(seg.remaining for seg in segments) == size


def test_download_state_round_trip(tmp_path: Path) -> None:
    state = DownloadState(
        "https://e.com/f", 100, '"x"', "f.bin", None, True, [Segment(0, 49, 10), Segment(50, 99)]
    )
    path = tmp_path / "s.json"
    state.save(path)
    loaded = DownloadState.load(path)
    assert loaded == state
    path.write_text("{broken")
    assert DownloadState.load(path) is None


def test_extract_links_from_page() -> None:
    links = extract_links(GALLERY_HTML.decode(), "http://site.example/page.html")
    by_url = {link.url: link for link in links}
    base = "http://site.example/files/"
    assert by_url[base + "report.pdf"].label == "Annual report"
    assert by_url[base + "report.pdf"].category == "document"
    assert by_url["https://example.com/archive.zip"].label == "All files"
    assert by_url[base + "photo.png"].category == "image"
    assert base + "photo-2x.png" in by_url and base + "photo-3x.png" in by_url
    assert by_url["http://site.example/gallery/full.jpg"].source == "a"
    assert by_url["http://site.example/gallery/thumb.jpg"].source == "img"
    assert by_url[base + "clip.mp4"].category == "video"
    assert by_url[base + "poster.jpg"].category == "image"
    assert (
        by_url["http://site.example/stream/song"].category == "audio"
    )  # no extension, but <audio>
    assert by_url[base + "live/playlist.m3u8"].category == "stream"
    assert by_url["https://cdn.example.com/cover.jpg"].source == "meta"
    # ordinary page links are kept as "link" after all files; javascript:/data: are dropped
    about = by_url["http://site.example/about"]
    assert about.category == "link" and about.label == "About us"
    assert links[-1].url == "http://site.example/about"
    assert not any(url.startswith(("javascript", "data")) for url in by_url)
    # duplicates are removed
    assert len(by_url) == len(links)


def test_extract_links_caps_and_rejects_internal_syntax() -> None:
    html = "".join(f'<a href="/f{i}.zip">x</a>' for i in range(600))
    html += '<a href="http://user:pw@e.com/a.zip">creds</a>'
    links = extract_links(html, "https://e.com/")
    assert len(links) == 500
    assert all("@" not in link.url for link in links)


SNIFF_HTML = """<html><head>
<link rel="icon" href="/favicon.ico">
<link rel="preload" as="image" href="/hero">
<style>.hero { background: url('/img/bg.webp') } .f { src: url(/font.woff2) }</style>
<script type="application/ld+json">{"@type": "VideoObject", "contentUrl": "https://v.example/movie.mp4",
 "thumbnailUrl": ["https://v.example/thumb.jpg"], "embedUrl": "https://www.youtube.com/embed/abc"}</script>
<script>var player = {file: "https:\\/\\/cdn.example\\/hls\\/master.m3u8?token=1"};</script>
</head><body>
<img data-src="/lazy/one.jpg" src="/placeholder.gif">
<div style="background-image:url(&quot;/img/tile.png&quot;)"></div>
<iframe src="https://www.youtube.com/embed/xyz"></iframe>
<a href="/download?id=7">Get it</a>
</body></html>"""


def test_extract_links_sniffs_lazy_css_scripts_and_embeds() -> None:
    media_pages = {"https://www.youtube.com/embed/xyz", "https://www.youtube.com/embed/abc"}
    links = extract_links(
        SNIFF_HTML, "https://site.example/p", lambda url: "Youtube" if url in media_pages else None
    )
    by_url = {link.url: link for link in links}
    assert by_url["https://site.example/lazy/one.jpg"].category == "image"
    assert by_url["https://site.example/img/bg.webp"].source == "style"
    assert by_url["https://site.example/img/tile.png"].source == "style"
    assert by_url["https://site.example/favicon.ico"].category == "image"
    assert by_url["https://site.example/hero"].category == "image"  # preload as=image, no extension
    assert by_url["https://v.example/movie.mp4"].source == "json-ld"
    assert by_url["https://cdn.example/hls/master.m3u8?token=1"].category == "stream"
    assert by_url["https://www.youtube.com/embed/xyz"].category == "media"
    assert by_url["https://www.youtube.com/embed/abc"].category == "media"
    assert by_url["https://site.example/download?id=7"].category == "link"
    assert "https://site.example/font.woff2" not in by_url  # unknown extension from CSS: ignored
    order = [link.category for link in links]
    assert order.index("media") > max(i for i, c in enumerate(order) if c not in ("media", "link"))
    assert order[-1] == "link"
