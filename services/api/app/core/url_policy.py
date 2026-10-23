"""URL validation and SSRF protection.

Two layers work together:

1. ``validate_url`` checks the syntax of a user supplied URL (scheme, credentials,
   hostname form, port) without touching the network.
2. ``DestinationPolicy.resolve`` resolves a hostname and rejects it unless *every*
   resolved address is a public unicast address. The guarded HTTP transport
   (``app.services.safe_http``) calls it at TCP-connect time and connects to the exact
   address that was checked, so a DNS answer cannot change between "check" and "use"
   (DNS rebinding / TOCTOU).

Never rely on frontend checks or regular expressions alone for this.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable, Iterable, Sequence
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from app.core.errors import AppError, ErrorCode

IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address
IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network
Resolver = Callable[[str, int], Awaitable[list[str]]]

MAX_URL_LENGTH = 2048
ALLOWED_SCHEMES = frozenset({"http", "https"})
# Ports below 1024 other than HTTP(S) usually belong to non-web services (SMTP, SSH, ...).
ALLOWED_LOW_PORTS = frozenset({80, 443})

BLOCKED_HOST_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
    ".intranet",
    ".lan",
    ".home.arpa",
    ".corp",
)
BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "metadata",
        "metadata.google.internal",
        "instance-data",
        "kubernetes",
        "kubernetes.default",
    }
)

# Addresses that ipaddress may treat as global but must never be reached.
EXPLICITLY_BLOCKED_NETWORKS: tuple[IPNetwork, ...] = tuple(
    ipaddress.ip_network(net)
    for net in (
        "0.0.0.0/8",
        "100.64.0.0/10",  # carrier-grade NAT, also Alibaba metadata 100.100.100.200
        "169.254.0.0/16",  # link-local, AWS/GCP/Azure metadata 169.254.169.254
        "192.0.0.0/24",
        "198.18.0.0/15",
        "224.0.0.0/4",  # multicast
        "240.0.0.0/4",  # reserved + broadcast
        "fd00:ec2::254/128",  # AWS IMDS over IPv6
        "fc00::/7",
        "fe80::/10",
        "ff00::/8",
    )
)
NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


@dataclass(frozen=True, slots=True)
class ValidatedURL:
    url: str
    scheme: str
    host: str  # IDNA-encoded hostname or IP literal (without brackets)
    port: int
    is_ip_literal: bool


def _embedded_ipv4(ip: ipaddress.IPv6Address) -> ipaddress.IPv4Address | None:
    if ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    if ip.sixtofour is not None:
        return ip.sixtofour
    if ip.teredo is not None:
        return ip.teredo[1]
    if ip in NAT64_PREFIX:
        return ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
    return None


def is_public_address(ip: IPAddress, extra_allowed: Sequence[IPNetwork] = ()) -> bool:
    """Return True only for globally routable unicast addresses."""
    if any(ip in net for net in extra_allowed if net.version == ip.version):
        return True
    if isinstance(ip, ipaddress.IPv6Address):
        embedded = _embedded_ipv4(ip)
        if embedded is not None and not is_public_address(embedded, extra_allowed):
            return False
    if any(ip in net for net in EXPLICITLY_BLOCKED_NETWORKS if net.version == ip.version):
        return False
    return bool(
        ip.is_global
        and not ip.is_multicast
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_private
        and not ip.is_reserved
        and not ip.is_unspecified
    )


def _looks_like_legacy_ipv4(host: str) -> bool:
    """Detect integer / octal / hex IPv4 spellings such as ``2130706433`` or ``0x7f.1``.

    ``getaddrinfo`` accepts these and maps them to real addresses, so they are a common
    way to smuggle ``127.0.0.1`` past naive filters. We refuse them outright.
    """
    try:
        socket.inet_aton(host)
    except OSError:
        return False
    try:
        ipaddress.IPv4Address(host)
    except ValueError:
        return True  # inet_aton accepted it but it is not canonical dotted-quad
    return False


def validate_url(raw: str) -> ValidatedURL:
    """Validate URL syntax. Raises ``AppError(INVALID_URL | BLOCKED_DESTINATION)``."""
    if not isinstance(raw, str):
        raise AppError(ErrorCode.INVALID_URL, "URL must be a string")
    candidate = raw.strip()
    if not candidate or len(candidate) > MAX_URL_LENGTH:
        raise AppError(ErrorCode.INVALID_URL, "URL is empty or too long")
    if any(ch in candidate for ch in "\r\n\t\x00 ") or any(ord(ch) < 0x20 for ch in candidate):
        raise AppError(ErrorCode.INVALID_URL, "URL contains whitespace or control characters")
    if "\\" in candidate:
        raise AppError(ErrorCode.INVALID_URL, "URL contains backslashes")

    try:
        parts = urlsplit(candidate)
        port = parts.port
    except ValueError as exc:
        raise AppError(ErrorCode.INVALID_URL, "URL could not be parsed") from exc

    scheme = parts.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise AppError(ErrorCode.INVALID_URL, "Only http and https URLs are supported")
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        raise AppError(ErrorCode.INVALID_URL, "URLs with embedded credentials are not allowed")

    host = parts.hostname
    if not host:
        raise AppError(ErrorCode.INVALID_URL, "URL has no hostname")
    host = host.rstrip(".").lower()
    if not host:
        raise AppError(ErrorCode.INVALID_URL, "URL has no hostname")

    if port is None:
        port = 443 if scheme == "https" else 80
    if port < 1024 and port not in ALLOWED_LOW_PORTS:
        raise AppError(ErrorCode.BLOCKED_DESTINATION, "Destination port is not allowed")

    is_ip_literal = False
    try:
        ip = ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        ip = None
    if ip is not None:
        if "%" in host:
            raise AppError(ErrorCode.INVALID_URL, "Scoped IPv6 addresses are not allowed")
        is_ip_literal = True
        host = ip.compressed
    else:
        if _looks_like_legacy_ipv4(host):
            raise AppError(ErrorCode.INVALID_URL, "Non-standard IP address notation is not allowed")
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise AppError(ErrorCode.INVALID_URL, "Hostname is not valid") from exc
        if host in BLOCKED_HOSTNAMES or host.endswith(BLOCKED_HOST_SUFFIXES):
            raise AppError(ErrorCode.BLOCKED_DESTINATION, "Internal hostnames are not allowed")
        labels = host.split(".")
        if len(labels) < 2 or any(not label or len(label) > 63 for label in labels):
            raise AppError(ErrorCode.INVALID_URL, "Hostname is not a fully qualified domain")
        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-")
        if any(set(label) - allowed or label.startswith("-") for label in labels):
            raise AppError(ErrorCode.INVALID_URL, "Hostname contains invalid characters")

    netloc_host = f"[{host}]" if ":" in host else host
    default_port = 443 if scheme == "https" else 80
    netloc = netloc_host if port == default_port else f"{netloc_host}:{port}"
    normalized = urlunsplit((scheme, netloc, parts.path or "/", parts.query, ""))
    return ValidatedURL(normalized, scheme, host, port, is_ip_literal)


async def system_resolver(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


class DestinationPolicy:
    """Resolves hosts and enforces that every address is public."""

    def __init__(
        self,
        resolver: Resolver = system_resolver,
        extra_allowed_networks: Iterable[str] = (),
    ) -> None:
        # ``extra_allowed_networks`` exists ONLY so tests can talk to a local fixture
        # server. It is intentionally not configurable through environment variables.
        self._resolver = resolver
        self._extra_allowed: tuple[IPNetwork, ...] = tuple(
            ipaddress.ip_network(net) for net in extra_allowed_networks
        )

    def check_ip(self, ip: IPAddress) -> None:
        if not is_public_address(ip, self._extra_allowed):
            raise AppError(ErrorCode.BLOCKED_DESTINATION, "Destination address is not allowed")

    async def resolve(self, host: str, port: int) -> list[str]:
        """Return validated IP strings for ``host``; raise if any is non-public."""
        host = host.strip("[]")
        try:
            literal = ipaddress.ip_address(host)
        except ValueError:
            literal = None
        if literal is not None:
            self.check_ip(literal)
            return [literal.compressed]

        try:
            addresses = await self._resolver(host, port)
        except (OSError, UnicodeError) as exc:
            raise AppError(ErrorCode.SOURCE_UNAVAILABLE, "Hostname could not be resolved") from exc
        if not addresses:
            raise AppError(ErrorCode.SOURCE_UNAVAILABLE, "Hostname could not be resolved")

        validated: list[str] = []
        for addr in addresses:
            try:
                ip = ipaddress.ip_address(addr.split("%", 1)[0])
            except ValueError as exc:
                raise AppError(ErrorCode.BLOCKED_DESTINATION, "Invalid resolved address") from exc
            # Reject the whole host if ANY answer is internal: an attacker controlled
            # DNS zone could otherwise mix a public and a private record.
            self.check_ip(ip)
            validated.append(ip.compressed)
        return validated

    async def validate(self, raw_url: str) -> ValidatedURL:
        """Full pre-flight check: syntax plus DNS resolution."""
        parsed = validate_url(raw_url)
        await self.resolve(parsed.host, parsed.port)
        return parsed
