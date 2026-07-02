from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_returns_phase_one_status() -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "service": "titlelab-backend",
        "phase": "phase1-backend-foundation",
    }


def test_meta_returns_public_non_secret_information() -> None:
    response = client.get("/api/meta")

    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "titlelab-backend"
    assert data["project"] == "TitleLab"
    assert data["phase"] == "phase1-backend-foundation"
    assert data["api_base_domain"] == "api.title.mirroroo.top"
    assert data["api_base_url"] == "https://api.title.mirroroo.top"
    assert data["web_domain"] == "title.mirroroo.top"
    assert data["admin_domain"] == "admin.title.mirroroo.top"
    assert data["release_ready"] is False

    forbidden_keys = {"database_url", "token", "secret", "password", "appsecret", "api_key"}
    assert forbidden_keys.isdisjoint({key.lower() for key in data})
