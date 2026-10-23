import json
from pathlib import Path

from app.services import media

FIXTURE = json.loads((Path(__file__).parent.parent / "fixtures" / "ytdlp_video.json").read_text())


def test_only_real_formats_are_listed() -> None:
    info = media.parse_media_info(FIXTURE, ffmpeg_available=True)
    ids = [f.format_id for f in info.formats]
    # storyboard (mhtml) and DRM formats are dropped; nothing is invented
    assert ids == ["18", "137", "248", "140", "251"]
    assert max(f.height or 0 for f in info.formats) == 1080
    kinds = {f.format_id: f.kind for f in info.formats}
    assert kinds == {
        "18": "video+audio",
        "137": "video",
        "248": "video",
        "140": "audio",
        "251": "audio",
    }
    assert info.title == "Fixture video"
    assert info.duration_seconds == 63


def test_best_format_requires_ffmpeg_for_video_only() -> None:
    with_ffmpeg = media.parse_media_info(FIXTURE, ffmpeg_available=True)
    without_ffmpeg = media.parse_media_info(FIXTURE, ffmpeg_available=False)
    assert with_ffmpeg.best_format_id in ("137", "248")
    assert without_ffmpeg.best_format_id == "18"  # best format that needs no merge


def test_audio_only_source() -> None:
    data = {
        "title": "a",
        "formats": [
            {"format_id": "a1", "ext": "m4a", "vcodec": "none", "acodec": "mp4a", "abr": 128}
        ],
    }
    info = media.parse_media_info(data, ffmpeg_available=False)
    assert info.best_format_id == "a1"


def test_unsafe_format_ids_are_dropped() -> None:
    data = {
        "formats": [{"format_id": "1; rm -rf /", "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a"}]
    }
    assert media.parse_media_info(data, ffmpeg_available=False).formats == []


def test_download_args_are_a_list_and_url_is_after_double_dash(tmp_path: Path) -> None:
    url = "https://example.com/watch?v=--exec=evil"
    args = media.build_download_args(url, "137+bestaudio", tmp_path, 1000, "/usr/bin/ffmpeg")
    assert isinstance(args, list)
    assert args[-2:] == ["--", url]
    assert "--no-config" in args and "--no-playlist" in args
    assert args[args.index("-f") + 1] == "137+bestaudio"
    assert args[args.index("--max-filesize") + 1] == "1000"


def test_parse_progress() -> None:
    assert media.parse_progress("UDPROG 100 1000 NA") == (100, 1000)
    assert media.parse_progress("UDPROG 100 NA 2000.5") == (100, 2000)
    assert media.parse_progress("UDPROG NA NA NA") is None
    assert media.parse_progress("/tmp/x/media.mp4") is None


def test_ffmpeg_path_missing(tmp_path: Path) -> None:
    assert media.ffmpeg_path(str(tmp_path / "nope")) is None
    assert media.ffmpeg_path(str(tmp_path)) is None
