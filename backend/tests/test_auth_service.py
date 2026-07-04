from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import AuthIdentity, User, UserSession, Workspace, WorkspaceMember
from app.security.tokens import hash_session_token
from app.services.auth_service import (
    SessionExpiredError,
    SessionRevokedError,
    get_session_user,
    list_user_workspaces,
    login_with_wechat_identity,
    revoke_session,
)
from app.services.wechat_auth_service import WeChatIdentity


def test_login_with_wechat_identity_stores_only_token_hash(db_session: Session) -> None:
    login_time = datetime(2026, 7, 4, tzinfo=timezone.utc)
    result = login_with_wechat_identity(
        db_session,
        WeChatIdentity(openid="openid-new", unionid="union-new"),
        ttl_seconds=3600,
        device_label="iPhone",
        user_agent="pytest-agent",
        now=login_time,
    )

    stored_session = db_session.get(UserSession, result.session.id)
    identity = db_session.scalar(select(AuthIdentity).where(AuthIdentity.provider_user_id == "openid-new"))

    assert stored_session is not None
    assert identity is not None
    assert identity.user_id == result.user.id
    assert result.access_token != stored_session.token_hash
    assert stored_session.token_hash == hash_session_token(result.access_token)
    assert stored_session.device_label == "iPhone"
    assert stored_session.user_agent == "pytest-agent"

    resolved_session, resolved_user = get_session_user(db_session, result.access_token, now=login_time)
    assert resolved_session.id == stored_session.id
    assert resolved_user.id == result.user.id
    assert resolved_session.last_seen_at is not None


def test_existing_wechat_identity_reuses_user_and_lists_workspaces(db_session: Session) -> None:
    user = User(id="user-existing", openid="openid-existing", display_name="Existing User", status="active")
    workspace = Workspace(id="workspace-existing", name="Workspace Existing", slug="workspace-existing")
    db_session.add_all(
        [
            user,
            workspace,
            WorkspaceMember(id="member-existing", workspace_id=workspace.id, user_id=user.id, role="owner"),
            AuthIdentity(
                id="identity-existing",
                user_id=user.id,
                provider="wechat",
                provider_user_id="openid-existing",
            ),
        ]
    )
    db_session.commit()

    result = login_with_wechat_identity(db_session, WeChatIdentity(openid="openid-existing"), ttl_seconds=3600)
    memberships = list_user_workspaces(db_session, result.user.id)

    assert result.user.id == "user-existing"
    assert [(workspace.id, member.role) for workspace, member in memberships] == [("workspace-existing", "owner")]


def test_revoked_and_expired_sessions_are_rejected(db_session: Session) -> None:
    user = User(id="user-session-state", username="session-state", status="active")
    db_session.add(user)
    db_session.add_all(
        [
            UserSession(
                id="session-revoked",
                user_id=user.id,
                token_hash=hash_session_token("revoked-token"),
                auth_mode="wechat_session",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                revoked_at=datetime.now(timezone.utc),
            ),
            UserSession(
                id="session-expired",
                user_id=user.id,
                token_hash=hash_session_token("expired-token"),
                auth_mode="wechat_session",
                expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            ),
        ]
    )
    db_session.commit()

    with pytest.raises(SessionRevokedError):
        get_session_user(db_session, "revoked-token")
    with pytest.raises(SessionExpiredError):
        get_session_user(db_session, "expired-token")
