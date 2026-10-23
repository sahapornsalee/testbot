from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.url_policy import DestinationPolicy
from app.main import create_app
from tests.conftest import WEB_HEADERS, wait_for_terminal


def test_unauthorized_job_access_returns_not_found(
    client: TestClient, fixture_server: str, settings: Settings, test_policy: DestinationPolicy
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"}).json()
    wait_for_terminal(client, job["id"])
    assert client.get(f"/api/v1/downloads/{job['id']}/file").status_code == 200

    # A different browser session (new cookie jar) must not see or fetch the job.
    other = TestClient(client.app, headers=WEB_HEADERS)
    other.get("/api/v1/health")  # obtain its own session cookie
    for method, path in [
        ("GET", f"/api/v1/downloads/{job['id']}"),
        ("GET", f"/api/v1/downloads/{job['id']}/file"),
        ("POST", f"/api/v1/downloads/{job['id']}/cancel"),
    ]:
        response = other.request(method, path)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "JOB_NOT_FOUND"
    assert other.get("/api/v1/downloads").json()["items"] == []


def test_job_id_must_be_well_formed(client: TestClient) -> None:
    assert client.get("/api/v1/downloads/../../etc/passwd").status_code == 404
    response = client.get("/api/v1/downloads/not-a-hex-id")
    assert response.status_code == 422


def test_path_traversal_in_content_disposition_is_neutralised(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/report"}).json()
    job = wait_for_terminal(client, job["id"])
    assert job["status"] == "completed"
    assert job["filename"] == "report.pdf"
    files = [p for p in Path(settings.download_dir).rglob("*") if p.is_file()]
    assert len(files) == 1
    assert files[0].resolve().is_relative_to(Path(settings.download_dir).resolve())
    assert (
        "report.pdf"
        in client.get(f"/api/v1/downloads/{job['id']}/file").headers["content-disposition"]
    )


def test_api_never_exposes_local_paths(
    client: TestClient, fixture_server: str, settings: Settings
) -> None:
    job = client.post("/api/v1/downloads", json={"url": fixture_server + "/image.png"}).json()
    wait_for_terminal(client, job["id"])
    body = client.get(f"/api/v1/downloads/{job['id']}").text + client.get("/api/v1/downloads").text
    assert str(settings.download_dir) not in body
    assert str(settings.temp_dir) not in body
    assert "file_path" not in body


def test_oversized_request_body_is_rejected(client: TestClient) -> None:
    response = client.post("/api/v1/inspect", json={"url": "https://example.com/" + "a" * 20000})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


@pytest.mark.parametrize(
    "bad", ["not a url", "file:///etc/passwd", "http://localhost/", "http://[::1]/"]
)
def test_malformed_or_internal_urls_rejected_by_api(client: TestClient, bad: str) -> None:
    for path in ("/api/v1/inspect", "/api/v1/downloads"):
        response = client.post(path, json={"url": bad})
        assert response.status_code in (403, 422)
        assert response.json()["error"]["code"] in ("INVALID_URL", "BLOCKED_DESTINATION")


def test_validation_errors_do_not_echo_input(client: TestClient) -> None:
    response = client.post(
        "/api/v1/downloads", json={"url": "https://e.com", "format_id": "<script>"}
    )
    assert response.status_code == 422
    assert "<script>" not in response.text
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_missing_client_header_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/inspect", json={"url": "https://example.com/"}, headers={"X-UD-Client": ""}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN_ORIGIN"


def test_foreign_origin_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/inspect",
        json={"url": "https://example.com/"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_cors_only_allows_allowlisted_origins(client: TestClient) -> None:
    ok = client.options(
        "/api/v1/inspect",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    bad = client.options(
        "/api/v1/inspect",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "access-control-allow-origin" not in bad.headers


def test_rate_limiting(settings: Settings, test_policy: DestinationPolicy) -> None:
    settings.rate_limit_per_minute = 3
    with TestClient(create_app(settings, policy=test_policy), headers=WEB_HEADERS) as limited:
        codes = [
            limited.post("/api/v1/inspect", json={"url": "ftp://x"}).status_code for _ in range(4)
        ]
    # Each call counts against the client IP and the session, so the budget runs out early.
    assert 429 in codes
    assert limited is not None


def test_auth_mode_requires_valid_token(
    tmp_path: Path, test_policy: DestinationPolicy, settings: Settings
) -> None:
    token = "t" * 32
    secured = settings.model_copy(update={"auth_required": True, "api_tokens": [token]})
    with TestClient(create_app(secured, policy=test_policy), headers=WEB_HEADERS) as api:
        assert api.get("/api/v1/downloads").status_code == 401
        bad = api.get("/api/v1/downloads", headers={"Authorization": "Bearer wrong"})
        assert bad.status_code == 401
        good = api.get("/api/v1/downloads", headers={"Authorization": f"Bearer {token}"})
        assert good.status_code == 200
        assert api.get("/api/v1/health").status_code == 200  # health stays public


def test_production_refuses_to_start_without_auth() -> None:
    with pytest.raises(ValueError, match="AUTH_REQUIRED"):
        Settings(app_env="production", auth_required=False, _env_file=None)
    with pytest.raises(ValueError, match="at least one token"):
        Settings(app_env="production", auth_required=True, api_tokens=[], _env_file=None)


def test_security_headers_present(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    cookie = response.headers.get("set-cookie", "")
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie
