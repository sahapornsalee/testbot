"""Application settings loaded from environment variables (and an optional .env file)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_host: str = "127.0.0.1"
    api_port: int = 8000

    database_url: str = "sqlite:///./data/app.db"
    download_dir: Path = Path("./data/downloads")
    temp_dir: Path = Path("./data/tmp")

    max_file_size_mb: int = Field(default=1024, ge=1)
    max_storage_mb: int = Field(default=10240, ge=1)
    max_concurrent_jobs: int = Field(default=2, ge=1, le=32)
    # Queued + running + paused jobs one owner may have (the queue length).
    max_active_jobs_per_owner: int = Field(default=500, ge=1)
    # Parallel connections per direct download (IDM-style segmented download).
    max_connections_per_download: int = Field(default=8, ge=1, le=16)
    # Files smaller than 2 x this are downloaded over a single connection.
    min_segment_size_kb: int = Field(default=1024, ge=16)
    max_batch_size: int = Field(default=50, ge=1, le=500)
    max_page_bytes: int = Field(default=2 * 1024 * 1024, ge=64 * 1024)
    job_timeout_seconds: int = Field(default=1800, ge=10)
    connect_timeout_seconds: float = Field(default=10.0, gt=0)
    read_timeout_seconds: float = Field(default=30.0, gt=0)
    max_redirects: int = Field(default=5, ge=0, le=20)
    temp_file_ttl_hours: float = Field(default=6, gt=0)
    cleanup_interval_seconds: int = Field(default=300, ge=5)

    allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    auth_required: bool = False
    # Comma separated list of bearer tokens accepted when AUTH_REQUIRED=true.
    api_tokens: Annotated[list[str], NoDecode] = []

    rate_limit_per_minute: int = Field(default=60, ge=1)
    max_request_body_bytes: int = Field(default=128 * 1024, ge=1024)

    ytdlp_enabled: bool = True
    ffmpeg_location: str | None = None
    media_inspect_timeout_seconds: int = Field(default=60, ge=5)

    @field_validator("allowed_origins", "api_tokens", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _check_production_safety(self) -> Settings:
        if self.app_env == "production":
            if not self.auth_required:
                raise ValueError(
                    "AUTH_REQUIRED must be true when APP_ENV=production; "
                    "the API must not be exposed publicly without authentication."
                )
            if "*" in self.allowed_origins:
                raise ValueError("ALLOWED_ORIGINS must be an explicit allowlist in production.")
        if self.auth_required and not self.api_tokens:
            raise ValueError("AUTH_REQUIRED=true needs at least one token in API_TOKENS.")
        if any(len(token) < 24 for token in self.api_tokens):
            raise ValueError("Every API_TOKENS entry must be at least 24 characters long.")
        return self

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def min_segment_bytes(self) -> int:
        return self.min_segment_size_kb * 1024

    @property
    def max_storage_bytes(self) -> int:
        return self.max_storage_mb * 1024 * 1024

    @property
    def sqlite_path(self) -> Path:
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            raise ValueError("Only sqlite:/// DATABASE_URL values are supported in the MVP.")
        return Path(self.database_url[len(prefix) :])


@lru_cache
def get_settings() -> Settings:
    return Settings()
