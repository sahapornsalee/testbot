"""FastAPI application factory and entrypoint."""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from functools import partial

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.api.routes import router
from app.core.config import Settings, get_settings
from app.core.context import AppContext
from app.core.errors import AppError, ErrorCode
from app.core.logging import configure_logging
from app.core.security import SESSION_COOKIE, BodySizeLimitMiddleware, RateLimiter, new_session_id
from app.core.url_policy import DestinationPolicy
from app.services.job_store import JobStore
from app.services.safe_http import build_client
from app.services.storage import Storage
from app.workers.runner import JobRunner

logger = logging.getLogger("universal_downloader.http")


def _error_response(error: AppError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"error": error.to_dict()})


def create_app(
    settings: Settings | None = None,
    policy: DestinationPolicy | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    policy = policy or DestinationPolicy()
    configure_logging()

    client_factory: Callable[[], httpx.AsyncClient] = partial(
        build_client, policy, settings.connect_timeout_seconds, settings.read_timeout_seconds
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        store = JobStore(settings.sqlite_path)
        storage = Storage(settings.download_dir, settings.temp_dir, settings.max_storage_bytes)
        runner = JobRunner(settings, store, storage, policy, client_factory)
        app.state.ctx = AppContext(
            settings=settings,
            policy=policy,
            store=store,
            storage=storage,
            runner=runner,
            rate_limiter=RateLimiter(settings.rate_limit_per_minute),
            client_factory=client_factory,
        )
        await runner.start()
        try:
            yield
        finally:
            await runner.stop()
            store.close()

    app = FastAPI(
        title="Universal Downloader API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.app_env != "production" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.app_env != "production" else None,
    )

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Do not echo the submitted values back.
        fields = sorted({".".join(str(p) for p in err.get("loc", [])[1:]) for err in exc.errors()})
        message = f"Invalid request fields: {', '.join(f for f in fields if f) or 'body'}"
        return _error_response(AppError(ErrorCode.VALIDATION_ERROR, message))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = ErrorCode.JOB_NOT_FOUND if exc.status_code == 404 else ErrorCode.VALIDATION_ERROR
        error = AppError(code, "Not found" if exc.status_code == 404 else "Request not allowed")
        return JSONResponse(status_code=exc.status_code, content={"error": error.to_dict()})

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error")
        return _error_response(AppError(ErrorCode.INTERNAL_ERROR, "Unexpected server error"))

    @app.middleware("http")
    async def session_and_logging(request: Request, call_next):  # noqa: ANN001,ANN202
        started = time.perf_counter()
        issue_cookie = False
        if not settings.auth_required and not request.cookies.get(SESSION_COOKIE):
            request.state.session_id = new_session_id()
            issue_cookie = True
        try:
            response = await call_next(request)
        except AppError as exc:  # raised by BodySizeLimitMiddleware while reading
            response = _error_response(exc)
        if issue_cookie:
            response.set_cookie(
                SESSION_COOKIE,
                request.state.session_id,
                httponly=True,
                samesite="strict",
                secure=settings.app_env == "production",
                max_age=60 * 60 * 24 * 30,
                path="/",
            )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,  # path only: never log query strings
                "status": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return response

    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization", "X-UD-Client"],
        expose_headers=["Content-Disposition"],
        max_age=600,
    )
    app.include_router(router)
    return app


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host=settings.app_host,
        port=settings.api_port,
        proxy_headers=False,
    )


if __name__ == "__main__":
    run()
