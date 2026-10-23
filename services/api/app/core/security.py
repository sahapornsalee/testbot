"""Request-level protections: identity, CSRF, rate limiting and request size."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import Settings
from app.core.errors import AppError, ErrorCode

SESSION_COOKIE = "ud_session"
CSRF_HEADER = "x-ud-client"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


def resolve_owner(request: Request, settings: Settings) -> str:
    """Identify who owns jobs. Tokens in AUTH mode, an HttpOnly session cookie otherwise."""
    if settings.auth_required:
        header = request.headers.get("authorization", "")
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise AppError(ErrorCode.UNAUTHORIZED, "A valid access token is required")
        for allowed in settings.api_tokens:
            if hmac.compare_digest(token.encode(), allowed.encode()):
                return f"tok:{_digest(token)}"
        raise AppError(ErrorCode.UNAUTHORIZED, "A valid access token is required")

    session = getattr(request.state, "session_id", None) or request.cookies.get(SESSION_COOKIE)
    if not session or len(session) < 32:
        raise AppError(ErrorCode.UNAUTHORIZED, "Session cookie missing")
    return f"ses:{_digest(session)}"


def check_csrf(request: Request, settings: Settings) -> None:
    """Unsafe requests must carry a custom header (forces a CORS preflight) and, when
    the browser sends an Origin, it must be allowlisted."""
    if request.method not in UNSAFE_METHODS:
        return
    if request.headers.get(CSRF_HEADER) != "web":
        raise AppError(ErrorCode.FORBIDDEN_ORIGIN, "Missing client header")
    origin = request.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        raise AppError(ErrorCode.FORBIDDEN_ORIGIN, "Origin is not allowed")


class RateLimiter:
    """In-memory sliding window limiter. Use Redis or the reverse proxy when running
    more than one API process."""

    def __init__(self, limit: int, window_seconds: float = 60.0) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str) -> None:
        now = time.monotonic()
        bucket = self._hits[key]
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            raise AppError(ErrorCode.RATE_LIMITED, "Too many requests, please slow down")
        bucket.append(now)
        if len(self._hits) > 10_000:  # bound memory under abuse
            for stale in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                del self._hits[stale]


def client_key(request: Request) -> str:
    # Deliberately ignores X-Forwarded-For: it is client controlled. When deployed behind
    # a trusted proxy, run uvicorn with --proxy-headers and --forwarded-allow-ips.
    return request.client.host if request.client else "unknown"


def new_session_id() -> str:
    return secrets.token_urlsafe(32)


class BodySizeLimitMiddleware:
    """Reject request bodies larger than ``max_bytes`` (with or without Content-Length)."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    too_large = int(value) > self.max_bytes
                except ValueError:
                    too_large = True
                if too_large:
                    await _send_error(send, AppError(ErrorCode.REQUEST_TOO_LARGE))
                    return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise AppError(ErrorCode.REQUEST_TOO_LARGE)
            return message

        await self.app(scope, limited_receive, send)


async def _send_error(send: Send, error: AppError) -> None:
    import json

    body = json.dumps({"error": error.to_dict()}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": error.status_code,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
