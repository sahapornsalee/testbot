import pytest

from app.core.errors import AppError, ErrorCode
from app.core.url_policy import validate_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://example.com", "https://example.com/"),
        ("HTTPS://Example.COM/a/b?x=1#frag", "https://example.com/a/b?x=1"),
        ("http://example.com:80/file", "http://example.com/file"),
        ("https://example.com:8443/file", "https://example.com:8443/file"),
        ("https://bücher.example/x", "https://xn--bcher-kva.example/x"),
        ("https://example.com./x", "https://example.com/x"),
        ("http://[2606:4700::1111]/", "http://[2606:4700::1111]/"),
    ],
)
def test_valid_urls_are_normalized(raw: str, expected: str) -> None:
    assert validate_url(raw).url == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "example.com/file",
        "ftp://example.com/file",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "data:text/plain,hi",
        "gopher://example.com",
        "https://user:pass@example.com/",
        "https://user@example.com/",
        "https://exa mple.com/",
        "https://example.com/\r\nHost: evil",
        "https://example.com\\@evil.com/",
        "https:///nohost",
        "https://singlelabel/",
        "https://exa_mple.com/",
        "https://-bad.example.com/",
        "http://2130706433/",
        "http://0x7f000001/",
        "http://017700000001/",
        "http://0x7f.1/",
        "http://127.1/",
        "http://[fe80::1%25eth0]/",
        "https://example.com:99999/",
        "https://" + "a" * 2050 + ".com/",
    ],
)
def test_invalid_urls_are_rejected(raw: str) -> None:
    with pytest.raises(AppError) as info:
        validate_url(raw)
    assert info.value.code in (ErrorCode.INVALID_URL, ErrorCode.BLOCKED_DESTINATION)


@pytest.mark.parametrize(
    "raw",
    [
        "http://localhost/",
        "http://LOCALHOST:8000/",
        "http://api.localhost/",
        "http://printer.local/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://service.internal/",
        "http://router.home.arpa/",
        "http://example.com:22/",
        "http://example.com:25/",
    ],
)
def test_internal_hostnames_and_ports_are_blocked(raw: str) -> None:
    with pytest.raises(AppError) as info:
        validate_url(raw)
    assert info.value.code == ErrorCode.BLOCKED_DESTINATION
