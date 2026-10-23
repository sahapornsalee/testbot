import pytest

from app.services import file_types as ft
from tests.conftest import JPEG_BYTES, PNG_BYTES


def test_magic_bytes_win_over_extension_and_declared_type() -> None:
    sniffed = ft.sniff_mime(JPEG_BYTES)
    assert sniffed == "image/jpeg"
    assert ft.resolve_mime("application/octet-stream", sniffed, "photo.png") == "image/jpeg"
    assert ft.resolve_mime("text/plain", ft.sniff_mime(PNG_BYTES), "x.txt") == "image/png"


def test_extension_is_only_a_last_resort() -> None:
    assert ft.resolve_mime(None, None, "song.mp3") == "audio/mpeg"
    assert ft.resolve_mime("application/pdf", None, "file.mp3") == "application/pdf"
    assert ft.resolve_mime(None, None, None) == "application/octet-stream"


@pytest.mark.parametrize(
    ("head", "mime"),
    [
        (b"%PDF-1.4", "application/pdf"),
        (b"PK\x03\x04rest", "application/zip"),
        (b"GIF89a....", "image/gif"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "image/webp"),
        (b"RIFF\x00\x00\x00\x00WAVEfmt ", "audio/wav"),
        (b"\x00\x00\x00\x18ftypmp42", "video/mp4"),
        (b"\x00\x00\x00\x18ftypM4A ", "audio/mp4"),
        (b"ID3\x03\x00", "audio/mpeg"),
        (b"\x1a\x45\xdf\xa3", "video/webm"),
        (b"  <!DOCTYPE html><html>", "text/html"),
        (b"MZ\x90\x00", "application/x-msdownload"),
    ],
)
def test_sniffing(head: bytes, mime: str) -> None:
    assert ft.sniff_mime(head) == mime


@pytest.mark.parametrize(
    ("mime", "category"),
    [
        ("image/png", "image"),
        ("video/mp4", "video"),
        ("audio/mpeg", "audio"),
        ("application/pdf", "document"),
        ("text/csv", "document"),
        ("application/json", "document"),
        ("application/zip", "archive"),
        ("application/x-msdownload", "other"),
    ],
)
def test_categorize(mime: str, category: str) -> None:
    assert ft.categorize(mime) == category


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("../../etc/passwd", "passwd"),
        ("..\\..\\windows\\system32\\evil.exe", "evil.exe"),
        ("CON", "_CON"),
        ("nul.txt", "_nul.txt"),
        ("  report  .PDF", "report.pdf"),
        ('a<b>c:"d|e?f*.txt', "a_b_c__d_e_f_.txt"),
        ("", "download"),
        ("..", "download"),
        (".hidden", "hidden"),
        ("name\x00with\x1fcontrol.txt", "name_with_control.txt"),
        ("file.", "file"),
    ],
)
def test_sanitize_filename(raw: str, expected: str) -> None:
    assert ft.sanitize_filename(raw) == expected


def test_sanitize_adds_extension_from_mime_and_limits_length() -> None:
    assert ft.sanitize_filename("photo", mime="image/jpeg") == "photo.jpg"
    long_name = ft.sanitize_filename("x" * 500 + ".zip")
    assert len(long_name) <= ft.MAX_FILENAME_LENGTH and long_name.endswith(".zip")


def test_content_disposition_parsing() -> None:
    assert ft.filename_from_content_disposition('attachment; filename="a b.pdf"') == "a b.pdf"
    assert (
        ft.filename_from_content_disposition("attachment; filename*=UTF-8''%E0%B8%A3%E0%B8%B2.txt")
        == "รา.txt"
    )
    assert ft.filename_from_content_disposition(None) is None


def test_risky_detection() -> None:
    assert ft.is_risky_filename("setup.EXE")
    assert not ft.is_risky_filename("photo.jpg")
