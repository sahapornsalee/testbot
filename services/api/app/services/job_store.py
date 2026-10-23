"""SQLite persistence for download jobs, plus the job state machine."""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass, fields
from datetime import UTC, datetime
from pathlib import Path

from app.core.errors import AppError, ErrorCode
from app.schemas.models import DownloadMode, JobStatus

S = JobStatus
ACTIVE_STATUSES = frozenset({S.QUEUED, S.INSPECTING, S.DOWNLOADING, S.PROCESSING})
TERMINAL_STATUSES = frozenset({S.COMPLETED, S.FAILED, S.CANCELLED, S.EXPIRED})
# Jobs that occupy a place in an owner's queue (paused jobs keep their partial data).
QUEUE_STATUSES = ACTIVE_STATUSES | {S.PAUSED}

ALLOWED_TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    S.QUEUED: frozenset({S.INSPECTING, S.PAUSED, S.FAILED, S.CANCELLED}),
    S.INSPECTING: frozenset({S.DOWNLOADING, S.PAUSED, S.FAILED, S.CANCELLED}),
    S.DOWNLOADING: frozenset({S.PROCESSING, S.PAUSED, S.FAILED, S.CANCELLED}),
    S.PROCESSING: frozenset({S.COMPLETED, S.FAILED, S.CANCELLED}),
    S.PAUSED: frozenset({S.QUEUED, S.CANCELLED, S.EXPIRED}),
    S.COMPLETED: frozenset({S.EXPIRED}),
    S.FAILED: frozenset(),
    S.CANCELLED: frozenset(),
    S.EXPIRED: frozenset(),
}


def can_transition(current: JobStatus, target: JobStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class JobRecord:
    id: str
    owner: str
    status: JobStatus
    mode: DownloadMode
    source_url: str
    source_host: str
    format_id: str | None = None
    merge_audio: bool = False
    filename: str | None = None
    category: str | None = None
    content_type: str | None = None
    expected_size: int | None = None
    actual_size: int | None = None
    downloaded_bytes: int = 0
    file_path: str | None = None  # relative to DOWNLOAD_DIR, never exposed via the API
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    connections: int | None = None
    paused_at: datetime | None = None


_COLUMNS = [f.name for f in fields(JobRecord)]
_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_host TEXT NOT NULL,
    format_id TEXT,
    merge_audio INTEGER NOT NULL DEFAULT 0,
    filename TEXT,
    category TEXT,
    content_type TEXT,
    expected_size INTEGER,
    actual_size INTEGER,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    connections INTEGER,
    paused_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_created ON jobs (owner, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
"""


def _to_row(job: JobRecord) -> dict[str, object]:
    row: dict[str, object] = {}
    for name in _COLUMNS:
        value = getattr(job, name)
        if isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, bool):
            value = int(value)
        elif isinstance(value, (JobStatus, DownloadMode)):
            value = value.value
        row[name] = value
    return row


def _from_row(row: sqlite3.Row) -> JobRecord:
    data = dict(row)
    for key in ("created_at", "started_at", "finished_at", "paused_at"):
        if data[key]:
            data[key] = datetime.fromisoformat(data[key])
    data["status"] = JobStatus(data["status"])
    data["mode"] = DownloadMode(data["mode"])
    data["merge_audio"] = bool(data["merge_audio"])
    return JobRecord(**data)


class JobStore:
    """Thread-safe, synchronous SQLite store. Calls are short, so it is safe to use
    from the event loop in the MVP. Replace with an async database for scale."""

    def __init__(self, path: Path) -> None:
        if str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.executescript(_SCHEMA)
        self._migrate()
        self._lock = threading.Lock()

    def _migrate(self) -> None:
        """Add columns introduced after a database was created (keeps job history)."""
        existing = {row[1] for row in self._conn.execute("PRAGMA table_info(jobs)")}
        for column, ddl in (("connections", "INTEGER"), ("paused_at", "TEXT")):
            if column not in existing:
                self._conn.execute(f"ALTER TABLE jobs ADD COLUMN {column} {ddl}")
        self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def insert(self, job: JobRecord) -> JobRecord:
        job.created_at = job.created_at or utcnow()
        row = _to_row(job)
        placeholders = ", ".join(f":{name}" for name in _COLUMNS)
        with self._lock, self._conn:
            self._conn.execute(
                f"INSERT INTO jobs ({', '.join(_COLUMNS)}) VALUES ({placeholders})",  # noqa: S608
                row,
            )
        return job

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return _from_row(row) if row else None

    def get_for_owner(self, job_id: str, owner: str) -> JobRecord:
        job = self.get(job_id)
        # Same error for "missing" and "belongs to someone else" to avoid leaking IDs.
        if job is None or job.owner != owner:
            raise AppError(ErrorCode.JOB_NOT_FOUND, "Job not found")
        return job

    def list_for_owner(self, owner: str, limit: int = 100) -> list[JobRecord]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM jobs WHERE owner = ? ORDER BY created_at DESC LIMIT ?",
                (owner, limit),
            ).fetchall()
        return [_from_row(row) for row in rows]

    def count_active_for_owner(self, owner: str) -> int:
        marks = ",".join("?" for _ in QUEUE_STATUSES)
        with self._lock:
            row = self._conn.execute(
                f"SELECT COUNT(*) FROM jobs WHERE owner = ? AND status IN ({marks})",  # noqa: S608
                (owner, *[s.value for s in QUEUE_STATUSES]),
            ).fetchone()
        return int(row[0])

    def list_by_status(self, statuses: frozenset[JobStatus]) -> list[JobRecord]:
        marks = ",".join("?" for _ in statuses)
        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM jobs WHERE status IN ({marks})",  # noqa: S608
                [s.value for s in statuses],
            ).fetchall()
        return [_from_row(row) for row in rows]

    def update(self, job_id: str, **changes: object) -> JobRecord:
        """Update fields. A ``status`` change must be a legal transition."""
        with self._lock, self._conn:
            row = self._conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if row is None:
                raise AppError(ErrorCode.JOB_NOT_FOUND, "Job not found")
            job = _from_row(row)
            new_status = changes.get("status")
            if new_status is not None and new_status != job.status:
                new_status = JobStatus(new_status)
                if not can_transition(job.status, new_status):
                    raise AppError(
                        ErrorCode.INVALID_STATE,
                        f"Cannot move job from {job.status.value} to {new_status.value}",
                    )
            for key, value in changes.items():
                if key not in _COLUMNS or key in ("id", "owner"):
                    raise ValueError(f"Unknown or immutable job field: {key}")
                setattr(job, key, value)
            row_data = _to_row(job)
            assignments = ", ".join(f"{key} = :{key}" for key in changes)
            self._conn.execute(
                f"UPDATE jobs SET {assignments} WHERE id = :id",  # noqa: S608
                {**{k: row_data[k] for k in changes}, "id": job_id},
            )
        return job
