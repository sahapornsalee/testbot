from pathlib import Path

import pytest

from app.core.errors import AppError, ErrorCode
from app.schemas.models import DownloadMode, JobStatus
from app.services.job_store import JobRecord, JobStore, can_transition

S = JobStatus


@pytest.mark.parametrize(
    ("current", "target", "allowed"),
    [
        (S.QUEUED, S.INSPECTING, True),
        (S.INSPECTING, S.DOWNLOADING, True),
        (S.DOWNLOADING, S.PROCESSING, True),
        (S.PROCESSING, S.COMPLETED, True),
        (S.COMPLETED, S.EXPIRED, True),
        (S.QUEUED, S.CANCELLED, True),
        (S.DOWNLOADING, S.FAILED, True),
        (S.QUEUED, S.COMPLETED, False),
        (S.DOWNLOADING, S.COMPLETED, False),
        (S.COMPLETED, S.DOWNLOADING, False),
        (S.CANCELLED, S.QUEUED, False),
        (S.FAILED, S.COMPLETED, False),
        (S.EXPIRED, S.COMPLETED, False),
    ],
)
def test_transitions(current: JobStatus, target: JobStatus, allowed: bool) -> None:
    assert can_transition(current, target) is allowed


def _job(job_id: str = "a" * 32, owner: str = "ses:one") -> JobRecord:
    return JobRecord(
        id=job_id,
        owner=owner,
        status=S.QUEUED,
        mode=DownloadMode.DIRECT,
        source_url="https://example.com/x",
        source_host="example.com",
    )


def test_store_rejects_illegal_transition(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.db")
    store.insert(_job())
    with pytest.raises(AppError) as info:
        store.update("a" * 32, status=S.COMPLETED)
    assert info.value.code == ErrorCode.INVALID_STATE
    assert store.get("a" * 32).status == S.QUEUED


def test_store_enforces_ownership(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.db")
    store.insert(_job())
    assert store.get_for_owner("a" * 32, "ses:one").id == "a" * 32
    with pytest.raises(AppError) as info:
        store.get_for_owner("a" * 32, "ses:two")
    assert info.value.code == ErrorCode.JOB_NOT_FOUND
    assert store.list_for_owner("ses:two") == []
    assert store.count_active_for_owner("ses:one") == 1


def test_store_round_trip(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.db")
    store.insert(_job())
    store.update("a" * 32, status=S.INSPECTING, merge_audio=True, expected_size=10)
    job = store.get("a" * 32)
    assert job.status == S.INSPECTING and job.merge_audio is True and job.expected_size == 10
    with pytest.raises(ValueError):
        store.update("a" * 32, owner="ses:evil")
