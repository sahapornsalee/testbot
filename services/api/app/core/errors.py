"""Stable error codes and the exception type used across the API.

Error messages returned to clients are short and generic; the frontend maps the
``code`` to a localized (Thai/English) message. Internal details never leave the server.
"""

from __future__ import annotations

from enum import StrEnum


class ErrorCode(StrEnum):
    INVALID_URL = "INVALID_URL"
    BLOCKED_DESTINATION = "BLOCKED_DESTINATION"
    UNSUPPORTED_SOURCE = "UNSUPPORTED_SOURCE"
    UNSUPPORTED_CONTENT = "UNSUPPORTED_CONTENT"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    STORAGE_FULL = "STORAGE_FULL"
    DOWNLOAD_TIMEOUT = "DOWNLOAD_TIMEOUT"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    TOO_MANY_REDIRECTS = "TOO_MANY_REDIRECTS"
    INCOMPLETE_DOWNLOAD = "INCOMPLETE_DOWNLOAD"
    FORMAT_NOT_AVAILABLE = "FORMAT_NOT_AVAILABLE"
    MEDIA_TOOL_MISSING = "MEDIA_TOOL_MISSING"
    MEDIA_PROCESSING_FAILED = "MEDIA_PROCESSING_FAILED"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    JOB_NOT_READY = "JOB_NOT_READY"
    INVALID_STATE = "INVALID_STATE"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    RATE_LIMITED = "RATE_LIMITED"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN_ORIGIN = "FORBIDDEN_ORIGIN"
    REQUEST_TOO_LARGE = "REQUEST_TOO_LARGE"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    CANCELLED = "CANCELLED"
    INTERRUPTED = "INTERRUPTED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.INVALID_URL: 422,
    ErrorCode.BLOCKED_DESTINATION: 403,
    ErrorCode.UNSUPPORTED_SOURCE: 422,
    ErrorCode.UNSUPPORTED_CONTENT: 415,
    ErrorCode.FILE_TOO_LARGE: 413,
    ErrorCode.STORAGE_FULL: 507,
    ErrorCode.DOWNLOAD_TIMEOUT: 504,
    ErrorCode.SOURCE_UNAVAILABLE: 502,
    ErrorCode.TOO_MANY_REDIRECTS: 502,
    ErrorCode.INCOMPLETE_DOWNLOAD: 502,
    ErrorCode.FORMAT_NOT_AVAILABLE: 422,
    ErrorCode.MEDIA_TOOL_MISSING: 503,
    ErrorCode.MEDIA_PROCESSING_FAILED: 500,
    ErrorCode.JOB_NOT_FOUND: 404,
    ErrorCode.JOB_NOT_READY: 409,
    ErrorCode.INVALID_STATE: 409,
    ErrorCode.QUOTA_EXCEEDED: 429,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.UNAUTHORIZED: 401,
    ErrorCode.FORBIDDEN_ORIGIN: 403,
    ErrorCode.REQUEST_TOO_LARGE: 413,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.CANCELLED: 409,
    ErrorCode.INTERRUPTED: 500,
    ErrorCode.INTERNAL_ERROR: 500,
}


class AppError(Exception):
    """An expected failure with a stable code that is safe to show to clients."""

    def __init__(self, code: ErrorCode, message: str | None = None) -> None:
        self.code = code
        self.message = message or code.value.replace("_", " ").capitalize()
        super().__init__(f"{code}: {self.message}")

    @property
    def status_code(self) -> int:
        return HTTP_STATUS.get(self.code, 400)

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code.value, "message": self.message}
