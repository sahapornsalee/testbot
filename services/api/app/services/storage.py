"""Download and temporary storage. All paths are confined to configured directories."""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path

from app.core.errors import AppError, ErrorCode


class Storage:
    def __init__(self, download_dir: Path, temp_dir: Path, max_bytes: int) -> None:
        self.download_dir = download_dir.resolve()
        self.temp_dir = temp_dir.resolve()
        self.max_bytes = max_bytes
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _confine(base: Path, candidate: Path) -> Path:
        resolved = candidate.resolve()
        if not resolved.is_relative_to(base):
            raise AppError(ErrorCode.INTERNAL_ERROR, "Refusing to access a path outside storage")
        return resolved

    def temp_path(self, job_id: str, suffix: str = ".part") -> Path:
        return self._confine(self.temp_dir, self.temp_dir / f"{job_id}{suffix}")

    def temp_job_dir(self, job_id: str) -> Path:
        path = self._confine(self.temp_dir, self.temp_dir / job_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def final_path(self, job_id: str, filename: str) -> Path:
        job_dir = self._confine(self.download_dir, self.download_dir / job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        return self._confine(job_dir, job_dir / filename)

    def relative(self, path: Path) -> str:
        return str(self._confine(self.download_dir, path).relative_to(self.download_dir))

    def resolve_relative(self, relative: str) -> Path:
        return self._confine(self.download_dir, self.download_dir / relative)

    def commit(self, source: Path, job_id: str, filename: str) -> Path:
        """Atomically move a finished temp file into the job's download directory."""
        target = self.final_path(job_id, filename)
        try:
            os.replace(source, target)
        except OSError:
            shutil.move(str(source), str(target))  # cross-device fallback
        return target

    def usage_bytes(self) -> int:
        total = 0
        for base in (self.download_dir, self.temp_dir):
            for root, _dirs, files in os.walk(base):
                for name in files:
                    try:
                        total += (Path(root) / name).stat().st_size
                    except OSError:
                        continue
        return total

    def ensure_capacity(self, extra_bytes: int) -> None:
        if self.usage_bytes() + max(extra_bytes, 0) > self.max_bytes:
            raise AppError(ErrorCode.STORAGE_FULL, "Temporary storage is full")

    def remove_job_files(self, job_id: str) -> None:
        for path in (
            self.download_dir / job_id,
            self.temp_dir / job_id,
            self.temp_dir / f"{job_id}.part",
        ):
            path = self._confine(path.parent.resolve(), path)
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            elif path.exists():
                path.unlink(missing_ok=True)

    def remove_job_files_temp_only(self, job_id: str) -> None:
        for path in (self.temp_dir / job_id, self.temp_dir / f"{job_id}.part"):
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            elif path.exists():
                path.unlink(missing_ok=True)

    def remove_stale_temp(self, max_age_seconds: float, keep: set[str]) -> int:
        """Delete temp entries older than ``max_age_seconds`` not belonging to ``keep``."""
        removed = 0
        cutoff = time.time() - max_age_seconds
        for entry in self.temp_dir.iterdir():
            job_id = entry.name.split(".", 1)[0]
            if job_id in keep:
                continue
            try:
                if entry.stat().st_mtime > cutoff:
                    continue
            except OSError:
                continue
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
            removed += 1
        return removed
