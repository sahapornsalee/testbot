"""An HTTPX client whose TCP connections can only reach validated public addresses.

``GuardedNetworkBackend`` replaces httpcore's network backend. Every TCP connection
resolves the hostname through ``DestinationPolicy`` and connects to the exact IP that
passed validation. TLS still uses the original hostname for SNI and certificate
verification, because httpcore performs the TLS handshake with the request origin.

Redirects are never followed automatically: ``open_stream`` follows them manually,
re-validating each hop and enforcing ``max_redirects``.
"""

from __future__ import annotations

import os
import ssl
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

import certifi
import httpcore
import httpx

from app.core.errors import AppError, ErrorCode
from app.core.url_policy import DestinationPolicy, validate_url

USER_AGENT = "UniversalDownloader/0.1 (+https://github.com/)"
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


class GuardedNetworkBackend(httpcore.AsyncNetworkBackend):
    def __init__(self, policy: DestinationPolicy) -> None:
        self._policy = policy
        self._inner = httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[httpcore.SOCKET_OPTION] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        addresses = await self._policy.resolve(host, port)
        last_error: Exception | None = None
        for address in addresses:
            try:
                return await self._inner.connect_tcp(
                    address,
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except (httpcore.ConnectError, httpcore.ConnectTimeout) as exc:
                last_error = exc
        assert last_error is not None
        raise last_error

    async def connect_unix_socket(
        self, *args: object, **kwargs: object
    ) -> httpcore.AsyncNetworkStream:
        raise AppError(ErrorCode.BLOCKED_DESTINATION, "Unix sockets are not allowed")

    async def sleep(self, seconds: float) -> None:
        await self._inner.sleep(seconds)


def _ssl_context() -> ssl.SSLContext:
    # Certificate verification is always on. SSL_CERT_FILE lets operators add a
    # corporate CA bundle; it never disables verification.
    return ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or certifi.where())


class GuardedTransport(httpx.AsyncHTTPTransport):
    def __init__(self, policy: DestinationPolicy) -> None:
        super().__init__(trust_env=False)
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=_ssl_context(),
            max_connections=20,
            max_keepalive_connections=5,
            keepalive_expiry=5.0,
            network_backend=GuardedNetworkBackend(policy),
        )


def build_client(
    policy: DestinationPolicy,
    connect_timeout: float,
    read_timeout: float,
) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=GuardedTransport(policy),
        follow_redirects=False,
        trust_env=False,  # never route through env proxies: it would bypass IP pinning
        timeout=httpx.Timeout(connect=connect_timeout, read=read_timeout, write=10, pool=10),
        headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"},
    )


@dataclass
class StreamResult:
    response: httpx.Response
    final_url: str
    redirect_chain: list[str] = field(default_factory=list)


def map_transport_error(exc: Exception) -> AppError:
    if isinstance(exc, AppError):
        return exc
    if isinstance(exc, httpx.TimeoutException):
        return AppError(ErrorCode.DOWNLOAD_TIMEOUT, "The source did not respond in time")
    if isinstance(exc, httpx.HTTPError):
        return AppError(ErrorCode.SOURCE_UNAVAILABLE, "The source could not be reached")
    return AppError(ErrorCode.SOURCE_UNAVAILABLE, "The source could not be reached")


@asynccontextmanager
async def open_stream(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_redirects: int,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> AsyncIterator[StreamResult]:
    """Open a streaming response, following redirects manually and safely."""
    current = validate_url(url).url
    chain: list[str] = []
    for _ in range(max_redirects + 1):
        request = client.build_request(method, current, headers=headers)
        try:
            response = await client.send(request, stream=True)
        except Exception as exc:  # noqa: BLE001 - mapped to a safe error
            raise map_transport_error(exc) from exc

        if response.status_code in REDIRECT_STATUSES:
            location = response.headers.get("location")
            await response.aclose()
            if not location:
                raise AppError(ErrorCode.SOURCE_UNAVAILABLE, "Redirect without a location")
            chain.append(current)
            next_url = str(httpx.URL(current).join(location))
            # Each hop is re-validated; DNS is re-checked at connect time.
            current = validate_url(next_url).url
            if response.status_code == 303:
                method = "GET"
            continue

        try:
            yield StreamResult(response=response, final_url=current, redirect_chain=chain)
        finally:
            await response.aclose()
        return

    raise AppError(ErrorCode.TOO_MANY_REDIRECTS, "The source redirected too many times")
