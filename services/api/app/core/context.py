"""Shared application objects, created once per app instance."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.core.config import Settings
from app.core.security import RateLimiter
from app.core.url_policy import DestinationPolicy
from app.services.job_store import JobStore
from app.services.storage import Storage
from app.workers.runner import JobRunner


@dataclass
class AppContext:
    settings: Settings
    policy: DestinationPolicy
    store: JobStore
    storage: Storage
    runner: JobRunner
    rate_limiter: RateLimiter
    client_factory: Callable[[], httpx.AsyncClient]
