"""Optional tests against real websites. They can break when sites change, so they
only run with RUN_EXTERNAL_TESTS=1 (never in default CI)."""

import os
import shutil

import pytest

from app.services import media

pytestmark = [
    pytest.mark.external,
    pytest.mark.skipif(
        os.environ.get("RUN_EXTERNAL_TESTS") != "1", reason="set RUN_EXTERNAL_TESTS=1"
    ),
]


async def test_real_media_inspection() -> None:
    url = os.environ.get("EXTERNAL_MEDIA_URL", "https://www.youtube.com/watch?v=jNQXAC9IVRw")
    info = await media.inspect_media(url, timeout=90, ffmpeg=shutil.which("ffmpeg"))
    assert info.formats
    assert all(f.format_id for f in info.formats)
