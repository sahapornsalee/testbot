import pytest

from app.core.errors import AppError, ErrorCode
from app.services import hls

BASE = "https://cdn.example/v/master.m3u8"


def test_master_playlist_lists_real_variants() -> None:
    text = (
        "#EXTM3U\n"
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",FRAME-RATE=30\n'
        "360/index.m3u8\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=4000000,AVERAGE-BANDWIDTH=3500000,RESOLUTION=1920x1080\n"
        "https://other.example/1080.m3u8\n"
        '#EXT-X-STREAM-INF:BANDWIDTH=64000,CODECS="mp4a.40.2"\n'
        "audio.m3u8\n"
    )
    variants = hls.parse_playlist(text, BASE)
    assert [v.url for v in variants] == [
        "https://cdn.example/v/360/index.m3u8",
        "https://other.example/1080.m3u8",
        "https://cdn.example/v/audio.m3u8",
    ]
    info = hls.variants_to_media(variants, "clip", ffmpeg=True)
    assert [(f.format_id, f.height, f.kind) for f in info.formats] == [
        ("v0", 360, "video+audio"),
        ("v1", 1080, "video+audio"),
        ("v2", None, "audio"),
    ]
    assert info.best_format_id == "v1"
    assert info.formats[1].tbr == 3500.0  # average bandwidth preferred


def test_media_playlist_keys_and_sequence() -> None:
    text = (
        "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:7\n"
        '#EXT-X-KEY:METHOD=AES-128,URI="k.bin",IV=0x0102\n#EXTINF:2,\na.ts\n'
        "#EXT-X-KEY:METHOD=NONE\n#EXTINF:2.5,\nb.ts\n#EXT-X-ENDLIST\n"
    )
    playlist = hls.parse_playlist(text, BASE)
    assert [s.sequence for s in playlist.segments] == [7, 8]
    assert playlist.segments[0].key.uri == "https://cdn.example/v/k.bin"
    assert playlist.segments[0].key.iv == bytes(14) + b"\x01\x02"
    assert playlist.segments[1].key is None
    assert playlist.duration == 4.5


@pytest.mark.parametrize(
    ("text", "code"),
    [
        ("#EXTM3U\n#EXTINF:1,\na.ts\n", ErrorCode.UNSUPPORTED_SOURCE),  # live: no ENDLIST
        (
            '#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x"\n#EXTINF:1,\na.ts\n#EXT-X-ENDLIST\n',
            ErrorCode.UNSUPPORTED_SOURCE,
        ),
        (
            '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="k",KEYFORMAT="com.widevine"\n#EXTINF:1,\na.ts\n#EXT-X-ENDLIST\n',
            ErrorCode.UNSUPPORTED_SOURCE,
        ),
        (
            "#EXTM3U\n#EXT-X-BYTERANGE:100@0\n#EXTINF:1,\na.ts\n#EXT-X-ENDLIST\n",
            ErrorCode.UNSUPPORTED_CONTENT,
        ),
        ("not a playlist", ErrorCode.UNSUPPORTED_CONTENT),
        (
            "#EXTM3U\n#EXTINF:1,\njavascript:alert(1)\n#EXT-X-ENDLIST\n",
            ErrorCode.BLOCKED_DESTINATION,
        ),
    ],
)
def test_unsupported_or_unsafe_playlists(text: str, code: ErrorCode) -> None:
    with pytest.raises(AppError) as info:
        hls.parse_playlist(text, BASE)
    assert info.value.code == code


def test_decrypt_round_trip() -> None:
    from tests.conftest import _encrypt

    key, iv = bytes(16), bytes(range(16))
    assert hls._decrypt(_encrypt(b"hello segment", key, iv), key, iv) == b"hello segment"


def test_detection_and_titles() -> None:
    assert hls.is_playlist("https://a/b/c.m3u8?x=1", None)
    assert hls.is_playlist("https://a/b/stream", "application/vnd.apple.mpegURL; charset=utf-8")
    assert not hls.is_playlist("https://a/b/c.mp4", "video/mp4")
    assert hls.stream_title("https://a.example/shows/episode-5/index.m3u8") == "episode-5"
    assert hls.stream_title("https://a.example/master.m3u8") == "a.example"
    assert hls.stream_title("https://a.example/trailer.m3u8") == "trailer"
