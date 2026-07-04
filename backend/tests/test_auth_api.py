from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import AuthIdentity, ContentItem, User, UserSession, Workspace, WorkspaceMember
from app.security.tokens import hash_session_token
from app.services.wechat_auth_service import WeChatAuthService, WeChatIdentity, get_wechat_auth_service


class FakeWeChatAuthService(WeChatAuthService):
    def __init__(self, openid: str = "openid-member", unionid: str | None = "union-member") -> None:
        self.openid = openid
        self.unionid = unionid

    def exchange_code_for_wechat_identity(self, code: str) -> WeChatIdentity:
        assert code == "mock-code"
        return WeChatIdentity(openid=self.openid, unionid=self.unionid)


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
        seed_auth_data(session)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_wechat_auth_service] = lambda: FakeWeChatAuthService()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def client_without_wechat_override(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def seed_auth_data(session: Session) -> None:
    session.add_all(
        [
            User(id="user-member", openid="openid-member", display_name="Member User", status="active"),
            Workspace(id="workspace-a", name="Workspace A", slug="workspace-a"),
            WorkspaceMember(id="member-a", workspace_id="workspace-a", user_id="user-member", role="viewer"),
            AuthIdentity(
                id="identity-member",
                user_id="user-member",
                provider="wechat",
                provider_user_id="openid-member",
                provider_union_id="union-member",
            ),
            ContentItem(
                id="content-auth-a",
                workspace_id="workspace-a",
                content_type="title",
                text="授权标题",
                status="published",
            ),
        ]
    )
    session.commit()


def assert_success_envelope(data: dict[str, object]) -> None:
    assert data["code"] == "OK"
    assert data["message"] == "OK"
    assert isinstance(data["requestId"], str)
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"


def test_wechat_login_uses_mock_exchange_and_returns_plaintext_token_once(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post(
        "/api/v1/auth/wechat-login",
        json={"code": "mock-code", "deviceLabel": "devtools"},
        headers={"X-Request-Id": "auth-login-request-id", "User-Agent": "pytest-agent"},
    )

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "auth-login-request-id"
    envelope = response.json()
    assert_success_envelope(envelope)
    data = envelope["data"]
    assert data["tokenType"] == "Bearer"
    assert data["accessToken"]
    assert data["user"]["id"] == "user-member"
    assert data["memberships"] == [
        {"id": "workspace-a", "name": "Workspace A", "slug": "workspace-a", "role": "viewer"}
    ]

    stored_session = db_session.scalar(select(UserSession).where(UserSession.user_id == "user-member"))
    assert stored_session is not None
    assert stored_session.token_hash == hash_session_token(data["accessToken"])
    assert stored_session.token_hash != data["accessToken"]
    assert stored_session.device_label == "devtools"
    assert stored_session.user_agent == "pytest-agent"


def test_auth_me_and_readonly_api_accept_bearer_session(client: TestClient) -> None:
    login_response = client.post("/api/v1/auth/wechat-login", json={"code": "mock-code"})
    access_token = login_response.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    me_response = client.get("/api/v1/auth/me", headers=headers)
    readonly_response = client.get("/api/v1/workspaces/workspace-a/contents", headers=headers)

    assert me_response.status_code == 200
    assert_success_envelope(me_response.json())
    assert me_response.json()["data"]["user"]["id"] == "user-member"
    assert me_response.json()["data"]["memberships"][0]["id"] == "workspace-a"
    assert readonly_response.status_code == 200
    assert readonly_response.json()["data"]["items"][0]["id"] == "content-auth-a"


def test_logout_revokes_current_session(client: TestClient) -> None:
    login_response = client.post("/api/v1/auth/wechat-login", json={"code": "mock-code"})
    access_token = login_response.json()["data"]["accessToken"]
    headers = {"Authorization": f"Bearer {access_token}"}

    logout_response = client.post("/api/v1/auth/logout", headers=headers)
    me_after_logout = client.get("/api/v1/auth/me", headers=headers)

    assert logout_response.status_code == 200
    assert logout_response.json()["data"] == {"revoked": True}
    assert me_after_logout.status_code == 401
    assert me_after_logout.json()["code"] == "SESSION_REVOKED"
    assert me_after_logout.json()["message"] == "session_revoked"


def test_logout_requires_bearer_session_not_dev_header(client: TestClient) -> None:
    response = client.post("/api/v1/auth/logout", headers={"X-TitleLab-User-Id": "user-member"})

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
    assert response.json()["message"] == "missing_user_context"


def test_default_wechat_service_returns_stable_config_error_without_network_call(
    client_without_wechat_override: TestClient,
) -> None:
    response = client_without_wechat_override.post("/api/v1/auth/wechat-login", json={"code": "mock-code"})

    assert response.status_code == 503
    assert response.json()["code"] == "AUTH_CONFIG_ERROR"
    assert response.json()["message"] == "auth_config_error"
