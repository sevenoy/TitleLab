from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import AiGenerationRecord, User, UserSession, Workspace, WorkspaceMember
from app.security.tokens import hash_session_token


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    with TestingSessionLocal() as session:
        seed_ai_data(session)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def seed_ai_data(session: Session) -> None:
    session.add_all(
        [
            User(id="user-ai-member", username="ai-member", display_name="AI Member", status="active"),
            User(id="user-ai-other", username="ai-other", display_name="AI Other", status="active"),
            Workspace(id="workspace-ai", name="Workspace AI", slug="workspace-ai"),
            WorkspaceMember(id="member-ai", workspace_id="workspace-ai", user_id="user-ai-member", role="editor"),
            UserSession(
                id="session-ai-member",
                user_id="user-ai-member",
                token_hash=hash_session_token("ai-session-token"),
                auth_mode="wechat_session",
                expires_at=datetime(2099, 1, 1, tzinfo=timezone.utc),
            ),
        ]
    )
    session.commit()


def bearer_headers(token: str = "ai-session-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "X-Request-Id": "ai-request-id"}


def ai_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "sourceText": "这个内容讲如何为夏日新品写一个更适合小红书收藏的标题",
        "contentType": "title",
        "tone": "warm",
        "platform": "xiaohongshu",
        "count": 3,
        "constraints": ["不要夸张承诺"],
        "referenceTitles": ["夏日新品这样写更容易被收藏"],
        "locale": "zh-CN",
    }
    payload.update(overrides)
    return payload


def assert_success_envelope(data: dict[str, object]) -> None:
    assert data["code"] == "OK"
    assert data["message"] == "OK"
    assert data["requestId"] == "ai-request-id"
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"


def test_title_suggestions_success_requires_workspace_member_and_records_audit(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(),
        headers=bearer_headers(),
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "ai-request-id"
    envelope = response.json()
    assert_success_envelope(envelope)
    data = envelope["data"]
    assert data["provider"] == "mock"
    assert data["model"] == "titlelab-mock-title-v1"
    assert data["mock"] is True
    assert len(data["suggestions"]) == 3
    assert data["usageEstimate"]["requestedCount"] == 3
    assert data["usageEstimate"]["returnedCount"] == 3

    record = db_session.scalar(select(AiGenerationRecord).where(AiGenerationRecord.workspace_id == "workspace-ai"))
    assert record is not None
    assert record.user_id == "user-ai-member"
    assert record.provider == "mock"
    assert record.model == "titlelab-mock-title-v1"
    assert record.status == "succeeded"
    assert record.cost_amount == 0
    assert record.input_payload["promptVersion"] == "title-suggestions-v1"


def test_title_suggestions_accepts_dev_header_fallback_in_local_test_env(client: TestClient) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(count=1),
        headers={"X-TitleLab-User-Id": "user-ai-member"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["mock"] is True


def test_title_suggestions_missing_auth_is_unauthorized(client: TestClient) -> None:
    response = client.post("/api/v1/workspaces/workspace-ai/ai/title-suggestions", json=ai_payload())

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
    assert response.json()["message"] == "missing_user_context"


def test_title_suggestions_non_member_is_forbidden(client: TestClient) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(),
        headers={"X-TitleLab-User-Id": "user-ai-other"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"
    assert response.json()["message"] == "workspace_forbidden"


def test_title_suggestions_rejects_empty_input(client: TestClient) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(sourceText="   "),
        headers=bearer_headers(),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "AI_EMPTY_INPUT"
    assert response.json()["message"] == "AI_EMPTY_INPUT"


def test_title_suggestions_rejects_too_long_input(client: TestClient) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(sourceText="长" * 2001),
        headers=bearer_headers(),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "AI_INPUT_TOO_LONG"
    assert response.json()["message"] == "AI_INPUT_TOO_LONG"


def test_title_suggestions_clamps_count_and_warns_for_secret_like_input(client: TestClient) -> None:
    response = client.post(
        "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
        json=ai_payload(sourceText="Bearer sample-sensitive-value should not echo", count=8),
        headers=bearer_headers(),
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data["suggestions"]) == 5
    assert all("sample-sensitive-value" not in item["title"] for item in data["suggestions"])
    warning_codes = {warning["code"] for warning in data["warnings"]}
    assert warning_codes == {"COUNT_CLAMPED", "SECRET_LIKE_INPUT_REDACTED"}


def test_title_suggestions_real_provider_disabled_fails_fast(
    client: TestClient,
    db_session: Session,
) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        titlelab_ai_provider="openai",
        titlelab_ai_real_provider_enabled=False,
    )
    try:
        response = client.post(
            "/api/v1/workspaces/workspace-ai/ai/title-suggestions",
            json=ai_payload(),
            headers=bearer_headers(),
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 503
    assert response.json()["code"] == "AI_PROVIDER_DISABLED"
    assert db_session.scalar(select(AiGenerationRecord)) is None
