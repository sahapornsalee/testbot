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
    # ordinary page links, javascript: and data: URLs are not files
    assert "http://site.example/about" not in by_url
    assert not any(url.startswith(("javascript", "data")) for url in by_url)
    # duplicates are removed
    assert len(by_url) == len(links)


def test_extract_links_caps_and_rejects_internal_syntax() -> None:
    html = "".join(f'<a href="/f{i}.zip">x</a>' for i in range(600))
    html += '<a href="http://user:pw@e.com/a.zip">creds</a>'
    links = extract_links(html, "https://e.com/")
    assert len(links) == 500
    assert all("@" not in link.url for link in links)
