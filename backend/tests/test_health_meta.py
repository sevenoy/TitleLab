from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def assert_success_envelope(data: dict[str, object], expected_request_id: str | None = None) -> None:
    assert data["code"] == "OK"
    assert data["message"] == "OK"
    assert isinstance(data["requestId"], str)
    assert data["requestId"]
    if expected_request_id:
        assert data["requestId"] == expected_request_id
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"
    assert "data" in data


def test_healthz_returns_phase_one_status() -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "titlelab-backend",
        "phase": "phase5b-real-ai-provider-gate-readiness",
    }


def test_meta_returns_public_non_secret_information() -> None:
    response = client.get("/api/meta", headers={"X-Request-Id": "meta-request-id"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "meta-request-id"
    envelope = response.json()
    assert_success_envelope(envelope, expected_request_id="meta-request-id")

    data = envelope["data"]
    assert data["service"] == "titlelab-backend"
    assert data["project"] == "TitleLab"
    assert data["phase"] == "phase5b-real-ai-provider-gate-readiness"
    assert data["api_base_domain"] == "api.title.mirroroo.top"
    assert data["api_base_url"] == "https://api.title.mirroroo.top"
    assert data["web_domain"] == "title.mirroroo.top"
    assert data["admin_domain"] == "admin.title.mirroroo.top"
    assert data["release_ready"] is False

    forbidden_keys = {"database_url", "token", "secret", "password", "appsecret", "api_key"}
    assert forbidden_keys.isdisjoint({key.lower() for key in data})
