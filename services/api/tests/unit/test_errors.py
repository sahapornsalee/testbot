from app.core.errors import HTTP_STATUS, AppError, ErrorCode


def test_every_error_code_has_a_status() -> None:
    assert set(HTTP_STATUS) == set(ErrorCode)


def test_error_mapping() -> None:
    assert AppError(ErrorCode.BLOCKED_DESTINATION).status_code == 403
    assert AppError(ErrorCode.FILE_TOO_LARGE).status_code == 413
    assert AppError(ErrorCode.JOB_NOT_FOUND).status_code == 404
    assert AppError(ErrorCode.RATE_LIMITED).status_code == 429
    assert AppError(ErrorCode.INVALID_URL, "bad").to_dict() == {
        "code": "INVALID_URL",
        "message": "bad",
    }


def test_error_codes_match_frontend_translations() -> None:
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[4] / "apps" / "web" / "src" / "i18n" / "messages"
    for locale in ("en", "th"):
        messages = json.loads((root / f"{locale}.json").read_text(encoding="utf-8"))
        missing = {code.value for code in ErrorCode} - set(messages["errors"])
        assert not missing, f"{locale}.json is missing error translations: {sorted(missing)}"
